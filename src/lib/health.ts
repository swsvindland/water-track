import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { AppState } from "react-native";
import { openDatabaseAsync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { and, eq, ne } from "drizzle-orm";
import { drinks, preferences } from "@/db/schema";
import { initializeDatabase } from "@/db/provider";
import { healthAdapter, healthAvailable } from "./health-native";
import { bacWeight, healthBacSamples } from "./health-data";
export { healthAvailable } from "./health-native";
const TASK = "water-track-health-export";
const RETRY_DELAYS = [30_000, 120_000, 600_000, 1_800_000];

let running: Promise<void> | null = null;
let requested = false;
let failures = 0;
let retry: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
function notify() {
  for (const listener of listeners) listener();
}
export function subscribeHealthSync(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function healthSyncing() {
  return running !== null;
}
export function syncHealth() {
  requested = true;
  if (running) return running;
  clearTimeout(retry);
  running = (async () => {
    try {
      do {
        requested = false;
        await performSync();
      } while (requested);
      failures = 0;
    } catch (error) {
      // Back off while the app stays open; foregrounding and log changes retry sooner.
      retry = setTimeout(
        () => {
          if (AppState.currentState === "active") void syncHealth().catch(() => {});
        },
        RETRY_DELAYS[Math.min(failures++, RETRY_DELAYS.length - 1)]
      );
      throw error;
    } finally {
      running = null;
      notify();
    }
  })();
  notify();
  return running;
}
async function performSync() {
  const sqlite = await openDatabaseAsync("water-track.db", {
    enableChangeListener: true,
    useNewConnection: true,
  });
  try {
    await initializeDatabase(sqlite);
    const db = drizzle(sqlite);
    if (!db.select().from(preferences).get()?.healthEnabled) return;
    const enabled = () => !!db.select().from(preferences).get()?.healthEnabled;
    const adapter = await healthAdapter(false, enabled);
    let incomplete = false;
    try {
      const weight = await adapter.readWeight();
      if (!enabled()) return;
      if (weight !== undefined) {
        db.update(preferences)
          .set({ healthWeightKg: weight?.kg ?? null, healthWeightAt: weight?.time ?? null })
          .where(eq(preferences.id, 1))
          .run();
      }
    } catch {
      if (!enabled()) return;
      incomplete = true;
    }
    // Each revision is acknowledged only if every supported export succeeded.
    // Process a snapshot so denied permissions cannot create an endless drain loop.
    const pending = db
      .select()
      .from(drinks)
      .where(ne(drinks.revision, drinks.syncedRevision))
      .all();
    for (const d of pending) {
      if (!enabled()) return;
      try {
        if (!(await adapter.write(d))) {
          incomplete = true;
          continue;
        }
        db.update(drinks)
          .set({ syncedRevision: d.revision })
          .where(and(eq(drinks.id, d.id), eq(drinks.revision, d.revision)))
          .run();
      } catch {
        if (!enabled()) return;
        incomplete = true;
      }
    }
    const prefs = db.select().from(preferences).get()!;
    const rows = db.select().from(drinks).all();
    const samples = healthBacSamples(rows, bacWeight(prefs), prefs.bodyWaterRatio);
    const fingerprint = JSON.stringify(samples);
    if (adapter.writeBac && prefs.healthBacFingerprint !== fingerprint) {
      let bacComplete = true;
      for (const sample of samples) {
        if (!enabled()) return;
        try {
          if (!(await adapter.writeBac(sample.id, sample.fraction, sample.time)))
            bacComplete = false;
        } catch {
          bacComplete = false;
        }
      }
      if (!enabled()) return;
      if (bacComplete)
        db.update(preferences)
          .set({ healthBacFingerprint: fingerprint })
          .where(eq(preferences.id, 1))
          .run();
      else incomplete = true;
    }
    if (!enabled()) return;
    if (incomplete) throw new Error("partial");
    db.update(preferences)
      .set({ lastSync: Date.now(), healthError: null })
      .where(eq(preferences.id, 1))
      .run();
  } catch (error) {
    const db = drizzle(sqlite);
    db.update(preferences)
      .set({ healthError: "healthError" })
      .where(and(eq(preferences.id, 1), eq(preferences.healthEnabled, true)))
      .run();
    throw error;
  } finally {
    await sqlite.closeAsync();
  }
}
export async function connectHealth() {
  await healthAdapter(true);
}
export async function registerBackgroundSync() {
  if (
    healthAvailable &&
    (await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Available &&
    !(await TaskManager.isTaskRegisteredAsync(TASK))
  )
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
}
export async function unregisterBackgroundSync() {
  if (await TaskManager.isTaskRegisteredAsync(TASK)) await BackgroundTask.unregisterTaskAsync(TASK);
}
if (!TaskManager.isTaskDefined(TASK))
  TaskManager.defineTask(TASK, async () => {
    try {
      await syncHealth();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
