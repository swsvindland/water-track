import { Platform } from "react-native";
import Constants from "expo-constants";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { openDatabaseAsync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { and, eq, ne } from "drizzle-orm";
import { drinks, preferences, type Drink } from "@/db/schema";
import { initializeDatabase } from "@/db/provider";

const TASK = "water-track-health-export";
const WATER = "HKQuantityTypeIdentifierDietaryWater";
const CAFFEINE = "HKQuantityTypeIdentifierDietaryCaffeine";
export const healthAvailable =
  Constants.appOwnership !== "expo" && (Platform.OS === "ios" || Platform.OS === "android");

async function adapter(request: boolean) {
  if (!healthAvailable) throw new Error("unavailable");
  if (Platform.OS === "ios") {
    const hk = await import("@kingstinct/react-native-healthkit");
    if (!hk.isHealthDataAvailable()) throw new Error("unavailable");
    if (request) await hk.requestAuthorization({ toShare: [WATER, CAFFEINE] });
    if (
      [WATER, CAFFEINE].some(
        (type) => hk.authorizationStatusFor(type as typeof WATER | typeof CAFFEINE) !== 2
      )
    )
      throw new Error("permission");
    return async (d: Drink) => {
      for (const [type, value, unit] of [
        [WATER, d.abv === 0 ? d.volumeMl : 0, "mL"],
        [CAFFEINE, d.caffeineMg, "mg"],
      ] as const) {
        // Only this app's records with this UUID can be removed. Delete-before-write
        // also makes retries after interrupted writes safe and handles zero values.
        await hk.deleteObjects(type, {
          metadata: { withMetadataKey: "HKExternalUUID", value: d.id },
        });
        if (!d.deleted && value > 0) {
          const date = new Date(d.consumedAt);
          // HealthKit 14.1's generated metadata type intersects nutrition keys
          // with Record<string, never>; these two standard Apple keys are valid.
          const metadata = { HKExternalUUID: d.id, HKWasUserEntered: true } as Parameters<
            typeof hk.saveQuantitySample<typeof WATER | typeof CAFFEINE>
          >[5];
          const saved = await hk.saveQuantitySample(type, unit, value, date, date, metadata);
          if (!saved) throw new Error("write");
        }
      }
    };
  }
  const hc = await import("react-native-health-connect");
  if (!(await hc.initialize())) throw new Error("unavailable");
  const permissions = request
    ? await hc.requestPermission([{ accessType: "write", recordType: "Hydration" }])
    : await hc.getGrantedPermissions();
  if (!permissions.some((p) => p.accessType === "write" && p.recordType === "Hydration"))
    throw new Error("permission");
  return async (d: Drink) => {
    await hc.deleteRecordsByUuids("Hydration", [], [d.id]);
    if (!d.deleted && d.abv === 0)
      await hc.insertRecords([
        {
          recordType: "Hydration",
          startTime: new Date(d.consumedAt - 1000).toISOString(),
          endTime: new Date(d.consumedAt).toISOString(),
          volume: { value: d.volumeMl, unit: "milliliters" },
          metadata: { clientRecordId: d.id, clientRecordVersion: d.revision, recordingMethod: 3 },
        },
      ]);
  };
}
let running: Promise<void> | null = null;
export function syncHealth() {
  if (running) return running;
  running = (async () => {
    const sqlite = await openDatabaseAsync("water-track.db", {
      enableChangeListener: true,
      useNewConnection: true,
    });
    try {
      await initializeDatabase(sqlite);
      const db = drizzle(sqlite);
      if (!db.select().from(preferences).get()?.healthEnabled) return;
      const write = await adapter(false);
      // Drain again after each batch so edits made during an export are included.
      while (db.select().from(preferences).get()?.healthEnabled) {
        const pending = db
          .select()
          .from(drinks)
          .where(ne(drinks.revision, drinks.syncedRevision))
          .all();
        if (!pending.length) break;
        for (const d of pending) {
          if (!db.select().from(preferences).get()?.healthEnabled) return;
          await write(d);
          db.update(drinks)
            .set({ syncedRevision: d.revision })
            .where(and(eq(drinks.id, d.id), eq(drinks.revision, d.revision)))
            .run();
        }
      }
      db.update(preferences).set({ lastSync: Date.now() }).where(eq(preferences.id, 1)).run();
    } finally {
      await sqlite.closeAsync();
    }
  })().finally(() => {
    running = null;
  });
  return running;
}
export async function connectHealth() {
  await adapter(true);
}
export async function registerBackgroundSync() {
  if (healthAvailable && !(await TaskManager.isTaskRegisteredAsync(TASK)))
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
