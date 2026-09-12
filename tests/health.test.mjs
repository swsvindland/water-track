import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(file, mocks = {}) {
  const url = new URL(`../src/lib/${file}.ts`, import.meta.url);
  const exports = {};
  const require = createRequire(url);
  const code = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, {
    exports,
    Date,
    require: (id) => (Object.hasOwn(mocks, id) ? mocks[id] : require(id)),
  });
  return exports;
}
const metrics = load("metrics");
const data = load("health-data", { "./metrics": metrics });
const drink = {
  id: "drink",
  volumeMl: 355,
  caffeineMg: 50,
  abv: 5,
  consumedAt: Date.now() - 3600000,
  deleted: false,
  revision: 1,
};

test("health quantities preserve units, standard drinks, and deletions", () => {
  const values = data.healthDrinkValues(drink);
  assert.equal(values.waterMl, 0);
  assert.equal(values.caffeineMg, 50);
  assert.equal(values.standardDrinks, metrics.alcoholGrams(drink) / 14);
  const deleted = data.healthDrinkValues({ ...drink, deleted: true });
  assert.ok(Object.values(deleted).every((v) => v === 0));
  assert.equal(data.healthDrinkValues({ ...drink, abv: 0 }).waterMl, 355);
});

test("BAC exports convert percentage points to HealthKit fractions and reconcile later events", () => {
  const later = { ...drink, id: "later", consumedAt: drink.consumedAt + 1800000 };
  const samples = data.healthBacSamples([drink, later], 80, 0.68);
  assert.equal(
    samples[0].fraction,
    metrics.estimateBac([drink, later], 80, 0.68, drink.consumedAt) / 100
  );
  const edited = data.healthBacSamples([{ ...drink, deleted: true }, later], 80, 0.68);
  assert.equal(edited[0].fraction, null);
  assert.ok(edited[1].fraction < samples[1].fraction);
  assert.equal(edited[0].id, samples[0].id);
  assert.equal(data.healthBacSamples([drink], null, 0.68)[0].fraction, null);
  assert.equal(data.healthBacSamples([{ ...drink, abv: 0 }], 80, 0.68)[0].fraction, null);
});

test("weight validation and fallback preserve manual settings", () => {
  assert.ok(data.validHealthWeight(75, Date.now() - 1000));
  for (const kg of [NaN, Infinity, 0, 19, 401])
    assert.equal(data.validHealthWeight(kg, Date.now()), false);
  assert.equal(data.validHealthWeight(75, Date.now() + 10000), false);
  assert.equal(data.bacWeight({ healthEnabled: true, healthWeightKg: 75, weightKg: 80 }), 75);
  assert.equal(data.bacWeight({ healthEnabled: false, healthWeightKg: 75, weightKg: 80 }), 80);
  assert.equal(data.bacWeight({ healthEnabled: true, healthWeightKg: null, weightKg: 80 }), 80);
});

function native(platform, provider) {
  return load("health-native", {
    "react-native": { Platform: { OS: platform }, AppState: { currentState: "active" } },
    "expo-constants": { appOwnership: "standalone" },
    "./health-data": data,
    "@kingstinct/react-native-healthkit": provider,
    "react-native-health-connect": provider,
  });
}

test("HealthKit exports drink fields and labeled BAC estimates; opt-out prevents replacement", async () => {
  const writes = [],
    deletes = [];
  let enabled = true;
  const hk = {
    isHealthDataAvailable: () => true,
    authorizationStatusFor: () => 2,
    deleteObjects: async (type, filter) => {
      deletes.push([type, filter]);
    },
    saveQuantitySample: async (...args) => {
      writes.push(args);
      return { uuid: "ok" };
    },
    queryQuantitySamples: async () => [{ quantity: 77, startDate: new Date(Date.now() - 1000) }],
  };
  const adapter = await native("ios", hk).healthAdapter(false, () => enabled);
  assert.equal((await adapter.readWeight()).kg, 77);
  assert.equal(await adapter.write(drink), true);
  assert.equal(writes.length, 2); // Alcohol isn't also exported as hydration.
  assert.ok(deletes.every(([, f]) => f.metadata.value === drink.id));
  await adapter.writeBac("water-track:bac:drink", 0.0008, drink.consumedAt);
  assert.equal(writes.at(-1)[1], "%");
  assert.equal(writes.at(-1)[2], 0.0008);
  assert.equal(writes.at(-1)[5]["WaterTrack.Estimated"], true);
  assert.equal(writes.at(-1)[5].HKWasUserEntered, false);
  enabled = false;
  await assert.rejects(adapter.write(drink), /disabled/);
});

test("HealthKit denial skips that type but continues other exports", async () => {
  const saved = [];
  const adapter = await native("ios", {
    isHealthDataAvailable: () => true,
    authorizationStatusFor: (type) => (type.endsWith("DietaryCaffeine") ? 1 : 2),
    deleteObjects: async () => {},
    saveQuantitySample: async (type) => {
      saved.push(type);
      return true;
    },
  }).healthAdapter(false);
  assert.equal(await adapter.write(drink), false);
  assert.deepEqual(saved, ["HKQuantityTypeIdentifierNumberOfAlcoholicBeverages"]);
});

test("Health Connect exports caffeine as nutrition and reads the latest valid paginated weight", async () => {
  const writes = [],
    deletes = [];
  const hc = {
    SdkAvailabilityStatus: { SDK_AVAILABLE: 3 },
    getSdkStatus: async () => 3,
    initialize: async () => true,
    getGrantedPermissions: async () => [
      { accessType: "write", recordType: "Hydration" },
      { accessType: "write", recordType: "Nutrition" },
      { accessType: "read", recordType: "Weight" },
    ],
    deleteRecordsByUuids: async (...args) => {
      deletes.push(args);
    },
    insertRecords: async (records) => {
      writes.push(...records);
      return ["ok"];
    },
    readRecords: async (_, options) =>
      options.pageToken
        ? {
            records: [
              { time: new Date(Date.now() - 1000).toISOString(), weight: { inKilograms: 76 } },
            ],
          }
        : {
            records: [
              { time: new Date(Date.now() - 2000).toISOString(), weight: { inKilograms: 80 } },
            ],
            pageToken: "next",
          },
  };
  const adapter = await native("android", hc).healthAdapter(false);
  assert.equal((await adapter.readWeight()).kg, 76);
  assert.equal(await adapter.write(drink), true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].recordType, "Nutrition");
  assert.equal(writes[0].caffeine.unit, "milligrams");
  assert.equal(writes[0].caffeine.value, 50);
  assert.equal(adapter.writeBac, undefined);
  await adapter.write({ ...drink, deleted: true });
  assert.equal(writes.length, 1);
  assert.equal(deletes.length, 4);
});

function syncHarness(provider, initialRows = [drink]) {
  const state = {
    prefs: {
      id: 1,
      healthEnabled: true,
      healthWeightKg: null,
      weightKg: 80,
      bodyWaterRatio: 0.68,
      healthBacFingerprint: null,
    },
    rows: initialRows.map((d) => ({ ...d, syncedRevision: 0 })),
  };
  const fields = (table, names) => Object.fromEntries(names.map((name) => [name, { table, name }]));
  const schema = {
    drinks: fields("rows", ["id", "revision", "syncedRevision"]),
    preferences: fields("prefs", ["id", "healthEnabled"]),
  };
  const tableRows = (table) => (table === schema.drinks ? state.rows : [state.prefs]);
  const predicate =
    (a, b, unequal = false) =>
    (row) =>
      unequal
        ? row[a.name] !== (b?.name ? row[b.name] : b)
        : row[a.name] === (b?.name ? row[b.name] : b);
  const db = {
    select: () => ({
      from: (table) => {
        const query = {
          get: () => ({ ...tableRows(table)[0] }),
          all: () => tableRows(table).map((r) => ({ ...r })),
          where: (filter) => ({
            all: () =>
              tableRows(table)
                .filter(filter)
                .map((r) => ({ ...r })),
          }),
        };
        return query;
      },
    }),
    update: (table) => ({
      set: (values) => {
        const update = (filter = () => true) => ({
          run: () =>
            tableRows(table)
              .filter(filter)
              .forEach((r) => Object.assign(r, values)),
        });
        return { ...update(), where: update };
      },
    }),
  };
  const mod = load("health", {
    "expo-task-manager": { isTaskDefined: () => true },
    "expo-background-task": {},
    "expo-sqlite": { openDatabaseAsync: async () => ({ closeAsync: async () => {} }) },
    "drizzle-orm/expo-sqlite": { drizzle: () => db },
    "drizzle-orm": {
      eq: predicate,
      ne: (a, b) => predicate(a, b, true),
      and:
        (...filters) =>
        (r) =>
          filters.every((f) => f(r)),
    },
    "@/db/schema": schema,
    "@/db/provider": { initializeDatabase: async () => {} },
    "./health-native": {
      healthAvailable: true,
      healthAdapter: async (interactive, enabled) => {
        assert.equal(interactive, false);
        return provider(state, enabled);
      },
    },
    "./health-data": data,
  });
  return { ...mod, state };
}

test("sync keeps a concurrently edited revision pending and imports weight without replacing manual input", async () => {
  const harness = syncHarness((state) => ({
    readWeight: async () => ({ kg: 76, time: Date.now() - 1000 }),
    write: async () => {
      state.rows[0].revision = 2;
      return true;
    },
  }));
  await harness.syncHealth();
  assert.equal(harness.state.rows[0].syncedRevision, 0);
  assert.equal(harness.state.prefs.weightKg, 80);
  assert.equal(harness.state.prefs.healthWeightKg, 76);
});

test("partial failures retain pending records and surface an error without blocking other records", async () => {
  const written = [];
  const harness = syncHarness(
    () => ({
      readWeight: async () => null,
      write: async (d) => {
        written.push(d.id);
        return d.id !== "drink";
      },
    }),
    [drink, { ...drink, id: "second" }]
  );
  await assert.rejects(harness.syncHealth(), /partial/);
  assert.deepEqual(written, ["drink", "second"]);
  assert.equal(harness.state.rows[0].syncedRevision, 0);
  assert.equal(harness.state.rows[1].syncedRevision, 1);
  assert.equal(harness.state.prefs.healthError, "healthError");
  assert.equal(harness.state.prefs.lastSync, undefined);
});

test("turning sync off while weight is being read stops exports", async () => {
  let writes = 0;
  const harness = syncHarness((state) => ({
    readWeight: async () => {
      state.prefs.healthEnabled = false;
      return { kg: 76, time: Date.now() };
    },
    write: async () => {
      writes++;
      return true;
    },
  }));
  await harness.syncHealth();
  assert.equal(writes, 0);
  assert.equal(harness.state.prefs.healthWeightKg, null);
});
