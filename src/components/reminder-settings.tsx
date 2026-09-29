import { useEffect, useState } from "react";
import { AppState, Linking, View } from "react-native";
import { eq } from "drizzle-orm";
import { useDatabase } from "@/db/provider";
import { preferences, type Preferences } from "@/db/schema";
import type { Message } from "@/lib/i18n";
import { shiftDays, startOfDay } from "@/lib/metrics";
import {
  reminderPermission,
  remindersAvailable,
  requestReminderPermission,
  type ReminderPermission,
} from "@/lib/notifications";
import {
  dayPlan,
  morningGlassOptions,
  parseSchedule,
  sameEveryDay,
  scheduleFromModel,
  scheduleInstructions,
  schedulePrompt,
  upcomingReminders,
  validDay,
  weekOrder,
  windDownOptions,
  type ReminderDay,
} from "@/lib/reminders";
import { parseRoutine } from "@/lib/routine";
import { useApp } from "@/lib/store";
import {
  Button,
  Callout,
  ErrorText,
  Field,
  Heading,
  Label,
  Note,
  Select,
  Text,
  TimeInput,
  Value,
  useKitFormat,
} from "@/vector";
import { FormSection, SwitchField } from "@/components/fields";
import { useDates, useVolume } from "@/components/format";
import {
  generateSchedule,
  scheduleIntelligenceAvailability,
} from "../../modules/schedule-intelligence";

/** The schedule stores minutes after midnight; kit TimeInput edits a Date. */
const timeOf = (minutes: number) => new Date(2000, 0, 1, 0, minutes);
const minutesOf = (date: Date) => date.getHours() * 60 + date.getMinutes();

/**
 * Wake-up and bedtime side by side, each labelled above its picker. Per day, screen readers hear the day with
 * each ("Wake up, Monday"), since the day's name is only on the switch above the pair.
 */
function DayTimes({
  day,
  dayName,
  disabled,
  onChange,
}: {
  day: ReminderDay;
  dayName?: string;
  disabled: boolean;
  onChange: (patch: Partial<ReminderDay>) => void;
}) {
  const { t } = useApp();
  return (
    <View className="flex-row flex-wrap gap-3">
      <View className="min-w-36 flex-1">
        <TimeInput
          label={t("wakeUp")}
          accessibilityLabel={dayName ? t("wakeUpOnDay", { day: dayName }) : undefined}
          value={timeOf(day.wake)}
          minuteInterval={5}
          disabled={disabled}
          onChange={(date) => onChange({ wake: minutesOf(date) })}
        />
      </View>
      <View className="min-w-36 flex-1">
        <TimeInput
          label={t("bedtime")}
          accessibilityLabel={dayName ? t("bedtimeOnDay", { day: dayName }) : undefined}
          value={timeOf(day.bed)}
          minuteInterval={5}
          disabled={disabled}
          onChange={(date) => onChange({ bed: minutesOf(date) })}
        />
      </View>
    </View>
  );
}

export function ReminderSettings() {
  const { settings, rows, now, t } = useApp();
  const db = useDatabase();
  const format = useKitFormat();
  const dates = useDates();
  const volume = useVolume();
  const enabled = settings.remindersEnabled;
  const schedule = parseSchedule(settings.reminderSchedule);
  const windDown = settings.reminderWindDown;
  const [perDay, setPerDay] = useState(() => !sameEveryDay(schedule));
  const [permission, setPermission] = useState<ReminderPermission | null>(null);
  const [intelligence, setIntelligence] = useState(scheduleIntelligenceAvailability);
  const [description, setDescription] = useState(settings.reminderDescription ?? "");
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  // Sentences shown one per line, so no language has to join them with a space.
  const [aiMessage, setAiMessage] = useState<{ keys: Message[]; error: boolean } | null>(null);
  useEffect(() => {
    // Permission and Apple Intelligence can change in system settings while the app is open.
    function refresh() {
      void reminderPermission()
        .then(setPermission)
        .catch(() => {});
      setIntelligence(scheduleIntelligenceAvailability());
    }
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, []);
  if (!remindersAvailable) return null;

  function persist(update: Partial<Preferences>) {
    try {
      db.update(preferences).set(update).where(eq(preferences.id, 1)).run();
      setError("");
      return true;
    } catch {
      setError(t("saveError"));
      return false;
    }
  }
  async function toggle(next: boolean) {
    if (!next) {
      persist({ remindersEnabled: false });
      return;
    }
    setBusy(true);
    try {
      // The system prompt appears only from this switch, never from background scheduling.
      const granted = await requestReminderPermission(t("reminders"));
      setPermission(granted ? "granted" : await reminderPermission());
      if (granted) persist({ remindersEnabled: true });
    } catch {
      setError(t("saveError"));
    } finally {
      setBusy(false);
    }
  }
  function saveSchedule(next: ReminderDay[]) {
    return persist({ reminderSchedule: JSON.stringify(next) });
  }
  function updateDay(index: number, patch: Partial<ReminderDay>) {
    const { off, ...day } = { ...schedule[index], ...patch };
    saveSchedule(
      schedule.map((current, i) => (i === index ? (off ? { ...day, off } : day) : current))
    );
  }
  function updateEveryDay(patch: Partial<ReminderDay>) {
    const { wake, bed } = { ...schedule[weekOrder[0]], ...patch };
    saveSchedule(schedule.map(() => ({ wake, bed })));
  }
  function changePerDay(next: boolean) {
    setPerDay(next);
    // Returning to one schedule applies Monday's times to every day.
    if (!next && !sameEveryDay(schedule)) updateEveryDay({});
  }
  async function describe() {
    const text = description.trim();
    if (!text) return;
    setThinking(true);
    setAiMessage(null);
    try {
      // Common English descriptions are read directly; anything else goes to the on-device model.
      const result =
        parseRoutine(text, schedule, windDown) ??
        scheduleFromModel(
          await generateSchedule(scheduleInstructions, schedulePrompt(text, schedule)),
          schedule,
          windDown
        );
      if (
        persist({ reminderSchedule: JSON.stringify(result.schedule), reminderDescription: text })
      ) {
        setPerDay(!sameEveryDay(result.schedule));
        setAiMessage({
          keys: result.adjusted ? ["aiDone", "aiAdjusted"] : ["aiDone"],
          error: false,
        });
      }
    } catch {
      setAiMessage({ keys: ["aiError"], error: true });
    } finally {
      setThinking(false);
    }
  }

  const options = {
    goalMl: settings.goalMl,
    glassMl: settings.defaultMl,
    morningGlasses: settings.reminderMorningGlasses,
    windDownMinutes: windDown,
  };
  const plan = dayPlan(schedule, now, options);
  const recent = rows.filter((d) => !d.deleted && d.consumedAt >= shiftDays(startOfDay(now), -1));
  const next =
    enabled && permission === "granted"
      ? upcomingReminders(recent, schedule, options, now, 1)[0]
      : undefined;
  const clock = (time: number) => format.time(new Date(time));
  const weekday = (index: number, width: "short" | "long") => {
    // 4 January 2026 is a Sunday, so index matches Date#getDay().
    const day = new Date(2026, 0, 4 + index);
    return width === "short" ? format.weekdayShort(day) : format.weekdayLong(day);
  };
  const invalid = weekOrder.filter(
    (index) => !schedule[index].off && !validDay(schedule[index], windDown)
  );
  const hours = (minutes: number) =>
    t("hoursShort", { count: format.number(minutes / 60, 1, { fixed: false }) });
  const timeline = plan
    ? [
        plan.morningMl > 0 && {
          time: clock(plan.wakeAt),
          text: t("planStart", { amount: volume.text(plan.morningMl) }),
        },
        plan.hourlyMl > 0 && {
          time: plan.morningMl > 0 ? "" : clock(plan.wakeAt),
          text: t("planSteady", { amount: volume.text(plan.hourlyMl) }),
        },
        {
          time: clock(plan.cutoffAt),
          text: t("planFinish", { amount: volume.text(plan.goalMl) }),
        },
        { time: clock(plan.bedAt), text: t("bedtime") },
      ].filter((row) => !!row)
    : [];
  const showAi = ["available", "appleIntelligenceNotEnabled", "modelNotReady"].includes(
    intelligence
  );
  return (
    <FormSection eyebrow={t("reminders")}>
      <SwitchField
        label={t("remindersEnabled")}
        value={enabled}
        disabled={busy}
        onChange={(value) => void toggle(value)}
      />
      <Note>{t("remindersNote")}</Note>
      {(permission === "denied" || (enabled && permission === "undetermined")) && (
        <View className="items-start gap-3">
          <Callout tone="warning">{t("remindersDenied")}</Callout>
          <Button
            variant="secondary"
            icon="external"
            iconPosition="end"
            onPress={() => void Linking.openSettings()}
          >
            {t("openSettings")}
          </Button>
        </View>
      )}
      {showAi && (
        <View className="gap-3">
          {intelligence === "available" ? (
            <>
              <Field
                label={t("describeRoutine")}
                value={description}
                onChange={setDescription}
                placeholder={t("describeRoutineHint")}
                maxLength={500}
                multiline
                disabled={!enabled || thinking}
              />
              <Button
                variant="secondary"
                loading={thinking}
                loadingLabel={t("aiWorking")}
                disabled={!enabled || !description.trim()}
                onPress={() => void describe()}
              >
                {t("setUpWithAI")}
              </Button>
              {aiMessage &&
                (aiMessage.error ? (
                  <ErrorText message={t(aiMessage.keys[0])} />
                ) : (
                  <Callout tone="success">
                    {aiMessage.keys.map((key) => (
                      <Text key={key} variant="small">
                        {t(key)}
                      </Text>
                    ))}
                  </Callout>
                ))}
            </>
          ) : (
            <Note>{t(intelligence === "modelNotReady" ? "aiNotReady" : "aiNotEnabled")}</Note>
          )}
        </View>
      )}
      <View className="gap-3">
        <Heading level={3}>{t("schedule")}</Heading>
        <SwitchField
          label={t("variesByDay")}
          value={perDay}
          disabled={!enabled}
          onChange={changePerDay}
        />
        {perDay ? (
          weekOrder.map((index, position) => {
            const day = schedule[index];
            const name = weekday(index, "long");
            return (
              <View
                key={index}
                className={position ? "gap-2 border-t border-separator pt-3" : "gap-2"}
              >
                <SwitchField
                  label={name}
                  accessibilityLabel={t("remindersOnDay", { day: name })}
                  value={!day.off}
                  disabled={!enabled}
                  onChange={(on) => updateDay(index, { off: !on })}
                />
                <DayTimes
                  day={day}
                  dayName={name}
                  disabled={!enabled || !!day.off}
                  onChange={(patch) => updateDay(index, patch)}
                />
              </View>
            );
          })
        ) : (
          <DayTimes
            day={schedule[weekOrder[0]]}
            disabled={!enabled}
            onChange={(patch) => updateEveryDay(patch)}
          />
        )}
        {invalid.length > 0 && (
          // Per day, the Callout title names the days whose times do not fit.
          <Callout
            tone="danger"
            title={
              perDay ? format.list(invalid.map((index) => weekday(index, "short"))) : undefined
            }
          >
            {t("invalidSchedule", {
              min: format.number((windDown + 60) / 60, 1, { fixed: false }),
            })}
          </Callout>
        )}
      </View>
      <Select
        showTitle
        title={t("morningGlasses")}
        values={morningGlassOptions.map(String)}
        value={String(settings.reminderMorningGlasses)}
        label={(value) =>
          Number(value)
            ? t("glassesOf", {
                count: format.number(Number(value)),
                amount: volume.text(settings.defaultMl),
              })
            : format.number(0)
        }
        disabled={!enabled}
        onChange={(value) => persist({ reminderMorningGlasses: Number(value) })}
      />
      <Select
        showTitle
        title={t("windDown")}
        values={windDownOptions.map(String)}
        value={String(windDown)}
        label={(value) => hours(Number(value))}
        disabled={!enabled}
        onChange={(value) => persist({ reminderWindDown: Number(value) })}
      />
      <View className="gap-2 border-t border-separator pt-4">
        <Label accessibilityRole="header">{t("planToday")}</Label>
        {timeline.length ? (
          timeline.map((row, index) => (
            <View key={index} className="flex-row items-baseline gap-3">
              <View className="min-w-20">{row.time ? <Value value={row.time} /> : null}</View>
              <Text variant="small" className="flex-1">
                {row.text}
              </Text>
            </View>
          ))
        ) : (
          <Note>{t("planOff")}</Note>
        )}
        {next && (
          <Note>
            {t("nextReminder", {
              time:
                startOfDay(next.time) === startOfDay(now)
                  ? clock(next.time)
                  : dates.weekdayTime(next.time),
            })}
          </Note>
        )}
      </View>
      <ErrorText message={error} />
    </FormSection>
  );
}
