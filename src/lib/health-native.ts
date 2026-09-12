import { Platform } from "react-native";
import Constants from "expo-constants";
import type { Drink } from "@/db/schema";
import { healthDrinkValues, validHealthWeight } from "./health-data";

const WATER = "HKQuantityTypeIdentifierDietaryWater";
const CAFFEINE = "HKQuantityTypeIdentifierDietaryCaffeine";
const ALCOHOL = "HKQuantityTypeIdentifierNumberOfAlcoholicBeverages";
const BAC = "HKQuantityTypeIdentifierBloodAlcoholContent";
const WEIGHT = "HKQuantityTypeIdentifierBodyMass";
const writeTypes = [WATER, CAFFEINE, ALCOHOL, BAC] as const;
export const healthAvailable =
  Constants.appOwnership !== "expo" && (Platform.OS === "ios" || Platform.OS === "android");

export async function healthAdapter(request: boolean, enabled: () => boolean = () => true) {
  if (!healthAvailable) throw new Error("unavailable");
  function checkEnabled() {
    if (!enabled()) throw new Error("disabled");
  }
  if (Platform.OS === "ios") {
    const hk = await import("@kingstinct/react-native-healthkit");
    if (!hk.isHealthDataAvailable()) throw new Error("unavailable");
    if (request) await hk.requestAuthorization({ toShare: [...writeTypes], toRead: [WEIGHT] });
    const allowed = (type: (typeof writeTypes)[number]) => hk.authorizationStatusFor(type) === 2;
    async function replace(
      type: (typeof writeTypes)[number],
      id: string,
      value: number | null,
      unit: "mL" | "mg" | "count" | "%",
      time: number,
      estimated = false
    ) {
      if (!allowed(type)) return false;
      checkEnabled();
      await hk.deleteObjects(type, { metadata: { withMetadataKey: "HKExternalUUID", value: id } });
      checkEnabled();
      if (value !== null && value > 0) {
        const date = new Date(time);
        // Library metadata typings intersect common keys with Record<string, never>.
        const metadata = {
          HKExternalUUID: id,
          HKWasUserEntered: !estimated,
          ...(estimated
            ? {
                "WaterTrack.Estimated": true,
                "WaterTrack.Method":
                  "Widmark; immediate absorption; elimination 0.015 percentage points/hour",
              }
            : {}),
        } as unknown as Parameters<typeof hk.saveQuantitySample<typeof WATER>>[5];
        if (!(await hk.saveQuantitySample(type, unit, value, date, date, metadata)))
          throw new Error("write");
      }
      return true;
    }
    return {
      async readWeight() {
        checkEnabled();
        // Read authorization is private in HealthKit: an empty result also means denied.
        const samples = await hk.queryQuantitySamples(WEIGHT, {
          unit: "kg",
          ascending: false,
          limit: 0,
          filter: { date: { endDate: new Date(), strictEndDate: true } },
        });
        const sample = samples.find((s) => validHealthWeight(s.quantity, +s.startDate));
        return sample ? { kg: sample.quantity, time: +sample.startDate } : null;
      },
      async write(d: Drink) {
        const values = healthDrinkValues(d);
        let complete = true;
        for (const [type, value, unit] of [
          [WATER, values.waterMl, "mL"],
          [CAFFEINE, values.caffeineMg, "mg"],
          [ALCOHOL, values.standardDrinks, "count"],
        ] as const) {
          if (!(await replace(type, d.id, value, unit, d.consumedAt))) complete = false;
        }
        return complete;
      },
      writeBac: (id: string, fraction: number | null, time: number) =>
        replace(BAC, id, fraction, "%", time, true),
    };
  }
  const hc = await import("react-native-health-connect");
  if (
    (await hc.getSdkStatus()) !== hc.SdkAvailabilityStatus.SDK_AVAILABLE ||
    !(await hc.initialize())
  )
    throw new Error("unavailable");
  const requested = [
    { accessType: "write", recordType: "Hydration" },
    { accessType: "write", recordType: "Nutrition" },
    { accessType: "read", recordType: "Weight" },
  ] as const;
  let permissions = request
    ? await hc.requestPermission([...requested])
    : await hc.getGrantedPermissions();
  if (request) {
    try {
      await hc.requestPermission([
        { accessType: "read", recordType: "BackgroundAccessPermission" },
      ]);
    } catch {
      /* Older providers still support foreground sync. */
    }
    permissions = await hc.getGrantedPermissions();
  }
  const allowed = (recordType: string, accessType: "read" | "write") =>
    permissions.some((p) => p.recordType === recordType && p.accessType === accessType);
  if (request && !requested.some((p) => allowed(p.recordType, p.accessType)))
    throw new Error("permission");
  return {
    async readWeight() {
      if (!allowed("Weight", "read")) return null;
      if (Platform.OS === "android" && !allowed("BackgroundAccessPermission", "read")) {
        const { AppState } = await import("react-native");
        if (AppState.currentState !== "active") return undefined;
      }
      checkEnabled();
      // Without history permission Health Connect permits only the prior 30 days.
      let pageToken: string | undefined;
      let latest: { kg: number; time: number } | null = null;
      do {
        checkEnabled();
        const result = await hc.readRecords("Weight", {
          timeRangeFilter: {
            operator: "between",
            startTime: new Date(Date.now() - 29 * 86400000).toISOString(),
            endTime: new Date().toISOString(),
          },
          ascendingOrder: false,
          pageSize: 1000,
          pageToken,
        });
        for (const record of result.records) {
          const kg = record.weight.inKilograms,
            time = Date.parse(record.time);
          if (validHealthWeight(kg, time) && (!latest || time > latest.time)) latest = { kg, time };
        }
        pageToken = result.pageToken;
      } while (pageToken);
      return latest;
    },
    async write(d: Drink) {
      const values = healthDrinkValues(d);
      let complete = true;
      for (const type of ["Hydration", "Nutrition"] as const) {
        if (!allowed(type, "write")) {
          complete = false;
          continue;
        }
        checkEnabled();
        const id = type === "Hydration" ? d.id : `water-track:caffeine:${d.id}`;
        await hc.deleteRecordsByUuids(type, [], [id]);
        checkEnabled();
        const value = type === "Hydration" ? values.waterMl : values.caffeineMg;
        if (value <= 0) continue;
        const common = {
          startTime: new Date(d.consumedAt - 1000).toISOString(),
          endTime: new Date(d.consumedAt).toISOString(),
          metadata: { clientRecordId: id, clientRecordVersion: d.revision, recordingMethod: 3 },
        };
        const ids = await hc.insertRecords([
          type === "Hydration"
            ? {
                ...common,
                recordType: "Hydration",
                volume: { value, unit: "milliliters" },
              }
            : {
                ...common,
                recordType: "Nutrition",
                mealType: 0,
                caffeine: { value, unit: "milligrams" },
                name: d.name ?? d.kind,
              },
        ]);
        if (!ids.length) throw new Error("write");
      }
      return complete;
    },
    writeBac: undefined,
  };
}
