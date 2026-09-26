import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { getLocales } from "expo-localization";
import { openDatabaseAsync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { and, eq, gte } from "drizzle-orm";
import { drinks, preferences } from "@/db/schema";
import { initializeDatabase } from "@/db/provider";
import { languagePreference, localeTag, resolveLanguage, translate, type Message } from "./i18n";
import { formatVolume, shiftDays, startOfDay } from "./metrics";
import { parseSchedule, reminderContent, upcomingReminders } from "./reminders";

const TASK = "water-track-reminders";
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
async function readState() {
  const sqlite = await openDatabaseAsync("water-track.db", {
    enableChangeListener: true,
    useNewConnection: true,
  });
  try {
    await initializeDatabase(sqlite);
    const db = drizzle(sqlite);
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
  } finally {
    await sqlite.closeAsync();
  }
}
// Local notifications cannot check intake when they fire, so the next few days are scheduled
// ahead with today's deficits and rescheduled whenever drinks, settings, or the app state change.
async function performSync() {
  if (!remindersAvailable) return;
  const { prefs, rows } = await readState();
  const wanted: { identifier: string; title: string; body: string; time: number }[] = [];
  if (prefs?.remindersEnabled && (await reminderPermission()) === "granted") {
    const language = resolveLanguage(
      languagePreference(prefs.language),
      getLocales()[0]?.languageCode
    );
    const t = (key: Message) => translate(language, key);
    const locale = localeTag(language);
    await createChannel(t("reminders"));
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
  const key = (n: { identifier: string; title: string | null; body: string | null }) =>
    `${n.identifier}\n${n.title}\n${n.body}`;
  const scheduled = (await Notifications.getAllScheduledNotificationsAsync())
    .filter((n) => n.identifier.startsWith(PREFIX))
    .map((n) => ({ identifier: n.identifier, title: n.content.title, body: n.content.body }));
  const wantedKeys = new Set(wanted.map(key));
  const scheduledKeys = new Set(scheduled.map(key));
  for (const notification of scheduled)
    if (!wantedKeys.has(key(notification)))
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
  for (const notification of wanted)
    if (!scheduledKeys.has(key(notification)))
      await Notifications.scheduleNotificationAsync({
        identifier: notification.identifier,
        content: { title: notification.title, body: notification.body, sound: true },
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
