import { useEffect, useState } from "react";
import { AppState, Linking, Text, View } from "react-native";
import { Button, Card, Label, Select, Switch, TextArea, TextField } from "heroui-native";
import { eq } from "drizzle-orm";
import { useDatabase } from "@/db/provider";
import { preferences, type Preferences } from "@/db/schema";
import { interpolate } from "@/lib/i18n";
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
import { SystemLabel, SystemPanel, SystemValue } from "@/components/system";
import { TimePicker } from "@/components/time-picker";
import { Heading, Note } from "@/components/ui";
import {
  generateSchedule,
  scheduleIntelligenceAvailability,
} from "../../modules/schedule-intelligence";

function OptionSelect({
  label,
  value,
  options,
  isDisabled,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  isDisabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <View className="gap-2">
      <Label>{label}</Label>
      <Select
        isDisabled={isDisabled}
        value={options.find((option) => option.value === value)}
        onValueChange={(option) => {
          if (option) onChange(option.value);
        }}
      >
        <Select.Trigger className="border border-field-border" accessibilityLabel={label}>
          <Select.Value placeholder={label} />
          <Select.TriggerIndicator />
        </Select.Trigger>
        <Select.Portal>
          <Select.Overlay />
          <Select.Content presentation="popover" width="trigger">
            {options.map((option) => (
              <Select.Item key={option.value} {...option} />
            ))}
          </Select.Content>
        </Select.Portal>
      </Select>
    </View>
  );
}

export function ReminderSettings() {
  const { settings, rows, now, locale, t, number, volume } = useApp();
  const db = useDatabase();
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
  const [aiMessage, setAiMessage] = useState<{ text: string; error: boolean } | null>(null);
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
          text: result.adjusted ? `${t("aiDone")} ${t("aiAdjusted")}` : t("aiDone"),
          error: false,
        });
      }
    } catch {
      setAiMessage({ text: t("aiError"), error: true });
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
  const clock = (time: number) =>
    new Date(time).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  const weekday = (index: number, width: "short" | "long") =>
    // 4 January 2026 is a Sunday, so index matches Date#getDay().
    new Date(2026, 0, 4 + index).toLocaleDateString(locale, { weekday: width });
  const invalid = weekOrder.filter(
    (index) => !schedule[index].off && !validDay(schedule[index], windDown)
  );
  const hours = (minutes: number) =>
    interpolate(t("hoursShort"), { count: number(minutes / 60, 1) });
  const timeline = plan
    ? [
        plan.morningMl > 0 && {
          time: clock(plan.wakeAt),
          text: interpolate(t("planStart"), { amount: volume(plan.morningMl) }),
        },
        plan.hourlyMl > 0 && {
          time: plan.morningMl > 0 ? "" : clock(plan.wakeAt),
          text: interpolate(t("planSteady"), { amount: volume(plan.hourlyMl) }),
        },
        {
          time: clock(plan.cutoffAt),
          text: interpolate(t("planFinish"), { amount: volume(plan.goalMl) }),
        },
        { time: clock(plan.bedAt), text: t("bedtime") },
      ].filter((row) => !!row)
    : [];
  const showAi = ["available", "appleIntelligenceNotEnabled", "modelNotReady"].includes(
    intelligence
  );
  return (
    <Card className="rounded-md border border-border bg-surface p-6 shadow-none">
      <Card.Body className="gap-4">
        <Card.Title>{t("reminders")}</Card.Title>
        <View className="flex-row items-center justify-between gap-4">
          <Heading>{t("remindersEnabled")}</Heading>
          <Switch
            accessibilityLabel={t("remindersEnabled")}
            isSelected={enabled}
            isDisabled={busy}
            onSelectedChange={(value) => void toggle(value)}
          />
        </View>
        <Note>{t("remindersNote")}</Note>
        {(permission === "denied" || (enabled && permission === "undetermined")) && (
          <View className="gap-3">
            <Note error>{t("remindersDenied")}</Note>
            <Button variant="outline" onPress={() => void Linking.openSettings()}>
              {t("openSettings")}
            </Button>
          </View>
        )}
        <View className="gap-6" style={{ opacity: enabled ? 1 : 0.5 }}>
          {showAi && (
            <View className="gap-3">
              {intelligence === "available" ? (
                <>
                  <TextField isDisabled={!enabled || thinking}>
                    <Label>{t("describeRoutine")}</Label>
                    <TextArea
                      className="border border-field-border"
                      accessibilityLabel={t("describeRoutine")}
                      value={description}
                      onChangeText={setDescription}
                      placeholder={t("describeRoutineHint")}
                      maxLength={500}
                    />
                  </TextField>
                  <Button
                    variant="secondary"
                    isDisabled={!enabled || thinking || !description.trim()}
                    onPress={() => void describe()}
                  >
                    {t(thinking ? "aiWorking" : "setUpWithAI")}
                  </Button>
                  {aiMessage && <Note error={aiMessage.error}>{aiMessage.text}</Note>}
                </>
              ) : (
                <Note>{t(intelligence === "modelNotReady" ? "aiNotReady" : "aiNotEnabled")}</Note>
              )}
            </View>
          )}
          <View className="gap-3">
            <Heading>{t("schedule")}</Heading>
            <View className="flex-row items-center justify-between gap-4">
              <Text className="flex-1 text-base text-foreground">{t("variesByDay")}</Text>
              <Switch
                accessibilityLabel={t("variesByDay")}
                isSelected={perDay}
                isDisabled={!enabled}
                onSelectedChange={changePerDay}
              />
            </View>
            {perDay ? (
              weekOrder.map((index) => {
                const day = schedule[index];
                const name = weekday(index, "long");
                return (
                  <View key={index} className="flex-row items-center gap-2">
                    <Button
                      size="sm"
                      variant={day.off ? "outline" : "secondary"}
                      className="w-16"
                      isDisabled={!enabled}
                      accessibilityRole="switch"
                      accessibilityLabel={interpolate(t("remindersOnDay"), { day: name })}
                      accessibilityState={{ checked: !day.off }}
                      onPress={() => updateDay(index, { off: !day.off })}
                    >
                      {weekday(index, "short")}
                    </Button>
                    <TimePicker
                      label={`${name}, ${t("wakeUp")}`}
                      minutes={day.wake}
                      isDisabled={!enabled || !!day.off}
                      onChange={(wake) => updateDay(index, { wake })}
                    />
                    <Text className="text-muted">–</Text>
                    <TimePicker
                      label={`${name}, ${t("bedtime")}`}
                      minutes={day.bed}
                      isDisabled={!enabled || !!day.off}
                      onChange={(bed) => updateDay(index, { bed })}
                    />
                  </View>
                );
              })
            ) : (
              <>
                <View className="flex-row items-center justify-between gap-4">
                  <Text className="text-base text-foreground">{t("wakeUp")}</Text>
                  <TimePicker
                    label={t("wakeUp")}
                    minutes={schedule[weekOrder[0]].wake}
                    isDisabled={!enabled}
                    onChange={(wake) => updateEveryDay({ wake })}
                  />
                </View>
                <View className="flex-row items-center justify-between gap-4">
                  <Text className="text-base text-foreground">{t("bedtime")}</Text>
                  <TimePicker
                    label={t("bedtime")}
                    minutes={schedule[weekOrder[0]].bed}
                    isDisabled={!enabled}
                    onChange={(bed) => updateEveryDay({ bed })}
                  />
                </View>
              </>
            )}
            {invalid.length > 0 && (
              <Note error>
                {perDay ? `${invalid.map((index) => weekday(index, "short")).join(", ")}: ` : ""}
                {interpolate(t("invalidSchedule"), { min: number((windDown + 60) / 60, 1) })}
              </Note>
            )}
          </View>
          <View className="gap-3">
            <OptionSelect
              label={t("morningGlasses")}
              value={String(settings.reminderMorningGlasses)}
              options={morningGlassOptions.map((count) => ({
                value: String(count),
                label: count ? `${number(count)} × ${volume(settings.defaultMl)}` : number(0),
              }))}
              isDisabled={!enabled}
              onChange={(value) => persist({ reminderMorningGlasses: Number(value) })}
            />
            <OptionSelect
              label={t("windDown")}
              value={String(windDown)}
              options={windDownOptions.map((minutes) => ({
                value: String(minutes),
                label: hours(minutes),
              }))}
              isDisabled={!enabled}
              onChange={(value) => persist({ reminderWindDown: Number(value) })}
            />
            <SystemPanel className="gap-2 p-3">
              <SystemLabel>{t("planToday")}</SystemLabel>
              {timeline.length ? (
                timeline.map((row, index) => (
                  <View key={index} className="flex-row items-baseline gap-3">
                    <SystemValue className="w-20 text-sm">{row.time}</SystemValue>
                    <Text className="flex-1 text-sm text-foreground">{row.text}</Text>
                  </View>
                ))
              ) : (
                <Note>{t("planOff")}</Note>
              )}
              {next && (
                <Note>
                  {interpolate(t("nextReminder"), {
                    time:
                      startOfDay(next.time) === startOfDay(now)
                        ? clock(next.time)
                        : new Date(next.time).toLocaleString(locale, {
                            weekday: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          }),
                  })}
                </Note>
              )}
            </SystemPanel>
          </View>
        </View>
        {!!error && <Note error>{error}</Note>}
      </Card.Body>
    </Card>
  );
}
