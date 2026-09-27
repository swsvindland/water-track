import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { getLocales } from "expo-localization";
import { CryptoDigestAlgorithm, digestStringAsync } from "expo-crypto";
import { openDatabaseAsync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { and, eq, gte } from "drizzle-orm";
import { drinks, preferences } from "@/db/schema";
import { initializeDatabase } from "@/db/provider";
import {
  interpolate,
  languagePreference,
  localeTag,
  resolveLanguage,
  translate,
  type Message,
} from "./i18n";
import { formatVolume, shiftDays, startOfDay } from "./metrics";
import {
  QUICK_LOG_ACTION,
  REMINDER_CATEGORY,
  reminderIntake,
  type ReminderIntake,
} from "./quick-log";
import { parseSchedule, reminderContent, upcomingReminders } from "./reminders";

const TASK = "water-track-reminders";
const ACTION_TASK = "water-track-reminder-action";
const CHANNEL = "hydration-reminders";
const PREFIX = "hydration-reminder:";
export const remindersAvailable = Platform.OS === "ios" || Platform.OS === "android";

if (remindersAvailable)
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

export type ReminderPermission = "granted" | "denied" | "undetermined";
function allowed(status: Notifications.NotificationPermissionsStatus) {
  return status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}
export async function reminderPermission(): Promise<ReminderPermission> {
  if (!remindersAvailable) return "denied";
  const status = await Notifications.getPermissionsAsync();
  return allowed(status) ? "granted" : status.canAskAgain ? "undetermined" : "denied";
}
async function createChannel(name: string) {
  // Android 13+ shows the permission prompt only after a channel exists.
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
}
// Prompts only from the settings switch; scheduling never asks.
export async function requestReminderPermission(channelName: string) {
  if (!remindersAvailable) return false;
  await createChannel(channelName);
  if (allowed(await Notifications.getPermissionsAsync())) return true;
  return allowed(
    await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true } })
  );
}

let running: Promise<void> | null = null;
let requested = false;
export function syncReminders() {
  requested = true;
  if (running) return running;
  running = (async () => {
    do {
      requested = false;
      await performSync();
    } while (requested);
  })().finally(() => {
    running = null;
  });
  return running;
}
async function withDatabase<T>(work: (db: ReturnType<typeof drizzle>) => T) {
  const sqlite = await openDatabaseAsync("water-track.db", {
    enableChangeListener: true,
    useNewConnection: true,
  });
  try {
    await initializeDatabase(sqlite);
    return work(drizzle(sqlite));
  } finally {
    await sqlite.closeAsync();
  }
}
function readState() {
  return withDatabase((db) => {
    const prefs = db.select().from(preferences).get();
    const rows = prefs?.remindersEnabled
      ? db
          .select()
          .from(drinks)
          .where(
            and(
              eq(drinks.deleted, false),
              gte(drinks.consumedAt, shiftDays(startOfDay(Date.now()), -1))
            )
          )
          .all()
      : [];
    return { prefs, rows };
  });
}
// Local notifications cannot check intake when they fire, so the next few days are scheduled
// ahead with today's deficits and rescheduled whenever drinks, settings, or the app state change.
async function performSync() {
  if (!remindersAvailable) return;
  const { prefs, rows } = await readState();
  const wanted: {
    identifier: string;
    title: string;
    body: string;
    time: number;
    quickLog: ReminderIntake | null;
  }[] = [];
  if (prefs?.remindersEnabled && (await reminderPermission()) === "granted") {
    const language = resolveLanguage(
      languagePreference(prefs.language),
      getLocales()[0]?.languageCode
    );
    const t = (key: Message) => translate(language, key);
    const locale = localeTag(language);
    await createChannel(t("reminders"));
    let quickLog: ReminderIntake | null = null;
    try {
      quickLog = reminderIntake(prefs.defaultMl);
      // Categories are looked up when a notification is shown, so this also relabels
      // reminders that are already scheduled.
      await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
        {
          identifier: QUICK_LOG_ACTION,
          buttonTitle: interpolate(t("reminderAction"), {
            amount: formatVolume(quickLog.volumeMl, prefs.units, locale),
          }),
          options: { opensAppToForeground: false },
        },
      ]);
    } catch {
      quickLog = null;
    }
    const reminders = upcomingReminders(
      rows,
      parseSchedule(prefs.reminderSchedule),
      {
        goalMl: prefs.goalMl,
        glassMl: prefs.defaultMl,
        morningGlasses: prefs.reminderMorningGlasses,
        windDownMinutes: prefs.reminderWindDown,
      },
      Date.now()
    );
    for (const reminder of reminders)
      wanted.push({
        identifier: `${PREFIX}${reminder.time}`,
        time: reminder.time,
        quickLog,
        ...reminderContent(
          reminder,
          {
            morningTitle: t("reminderMorningTitle"),
            morningBody: t("reminderMorningBody"),
            title: t("reminderTitle"),
            body: t("reminderBody"),
          },
          (ml) => formatVolume(ml, prefs.units, locale)
        ),
      });
  }
  // Only touch notifications that changed so unchanged reminders keep their system slots.
  const key = (n: {
    identifier: string;
    title: string | null;
    body: string | null;
    quickLog: Partial<ReminderIntake> | null;
  }) => `${n.identifier}\n${n.title}\n${n.body}\n${n.quickLog?.volumeMl}`;
  const scheduled = (await Notifications.getAllScheduledNotificationsAsync())
    .filter((n) => n.identifier.startsWith(PREFIX))
    .map((n) => ({
      identifier: n.identifier,
      title: n.content.title,
      body: n.content.body,
      // Reminders scheduled before the quick-log action existed have neither, so they're replaced.
      quickLog:
        n.content.categoryIdentifier === REMINDER_CATEGORY
          ? ((n.content.data?.quickLog as Partial<ReminderIntake> | undefined) ?? null)
          : null,
    }));
  const wantedKeys = new Set(wanted.map(key));
  const scheduledKeys = new Set(scheduled.map(key));
  for (const notification of scheduled)
    if (!wantedKeys.has(key(notification)))
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
  for (const notification of wanted)
    if (!scheduledKeys.has(key(notification)))
      await Notifications.scheduleNotificationAsync({
        identifier: notification.identifier,
        content: {
          title: notification.title,
          body: notification.body,
          sound: true,
          ...(notification.quickLog && {
            categoryIdentifier: REMINDER_CATEGORY,
            data: { quickLog: notification.quickLog },
          }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notification.time,
          channelId: CHANNEL,
        },
      });
}

// Background runs extend the multi-day horizon when the app is not opened for a while.
export async function registerReminderRefresh() {
  if (
    remindersAvailable &&
    (await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Available &&
    !(await TaskManager.isTaskRegisteredAsync(TASK))
  )
    // expo-background-task shares one worker, using the most recently registered interval;
    // match health sync so neither feature slows the other down.
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
}
export async function unregisterReminderRefresh() {
  if (await TaskManager.isTaskRegisteredAsync(TASK)) await BackgroundTask.unregisterTaskAsync(TASK);
}
if (!TaskManager.isTaskDefined(TASK))
  TaskManager.defineTask(TASK, async () => {
    try {
      await syncReminders();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });

// On iOS the native watch bridge queues the drink so it is saved even if the app is suspended
// right after launching in the background. Android runs this in a headless task when the app
// isn't in the foreground and through the listener when it is; the ID derived from the reminder
// keeps a response that is delivered both ways from logging the drink twice.
async function logReminderDrink(response: Notifications.NotificationResponse) {
  if (Platform.OS !== "android" || response.actionIdentifier !== QUICK_LOG_ACTION) return;
  const identifier = response.notification.request.identifier;
  const hash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, identifier);
  const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  const now = Date.now();
  await withDatabase((db) => {
    const prefs = db.select().from(preferences).get();
    if (prefs)
      db.insert(drinks)
        .values({ ...reminderIntake(prefs.defaultMl), id, consumedAt: now, updatedAt: now })
        .onConflictDoNothing()
        .run();
  });
  // Action buttons don't dismiss Android notifications on their own.
  await Notifications.dismissNotificationAsync(identifier).catch(() => {});
  await syncReminders();
}
if (Platform.OS === "android") {
  if (!TaskManager.isTaskDefined(ACTION_TASK))
    TaskManager.defineTask<Notifications.NotificationTaskPayload>(ACTION_TASK, async ({ data }) => {
      try {
        if (data && "actionIdentifier" in data) await logReminderDrink(data);
        return Notifications.BackgroundNotificationTaskResult.NewData;
      } catch {
        return Notifications.BackgroundNotificationTaskResult.Failed;
      }
    });
  void Notifications.registerTaskAsync(ACTION_TASK).catch(() => {});
  Notifications.addNotificationResponseReceivedListener((response) => {
    void logReminderDrink(response).catch(() => {});
  });
}
