// Pendum Hydration's vault test fixture (tests/vault-fixture.cjs; app-owned, docs/vault.md §12). `seed` writes what
// a long-time user has at a schema level: drinks of several kinds (written to Health, edited after that, never
// sent, and tombstones of both kinds), the template's counter, and preferences with favorites, a reminder schedule
// and device state. The `counters` row and the preferences row come from initializeDatabase (through the
// descriptor's acquire()), so a fresh install needs no `fresh`; `seed` upserts both in case the DB was only
// migrated. The real src/db/provider.tsx runs in Node with React stubbed out: it renders nothing here.

/** The vault ships at this schema level (journal length); `seed` writes the same rows at every later level. */
const FIRST_LEVEL = 10;

const json = (value) => JSON.stringify(value);
const ms = (iso) => Date.parse(iso);

function insert(db, table, rows) {
  for (const row of rows) {
    const columns = Object.keys(row);
    db.runSync(
      `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      columns.map((c) => row[c])
    );
  }
}

function seed(db, { level }) {
  if (level < FIRST_LEVEL)
    throw new Error(`water fixture: no seed below schema level ${FIRST_LEVEL}`);
  const drink = (row) => ({
    name: null,
    caffeine_mg: 0,
    abv: 0,
    revision: 1,
    deleted: 0,
    synced_revision: 0,
    ...row,
    updated_at: row.updated_at ?? row.consumed_at,
  });
  db.withTransactionSync(() => {
    insert(db, "drinks", [
      // Written to Health (synced_revision = revision).
      drink({
        id: "0b3f6a52-7c1e-4d8a-9f20-1a2b3c4d5e01",
        kind: "water",
        volume_ml: 250,
        consumed_at: ms("2026-09-27T07:05:00.000Z"),
        synced_revision: 1,
      }),
      drink({
        id: "0b3f6a52-7c1e-4d8a-9f20-1a2b3c4d5e02",
        kind: "coffee",
        name: "Drip coffee",
        volume_ml: 236.5882365,
        caffeine_mg: 95,
        consumed_at: ms("2026-09-27T08:30:00.000Z"),
        synced_revision: 1,
      }),
      // Edited after it was written to Health.
      drink({
        id: "0b3f6a52-7c1e-4d8a-9f20-1a2b3c4d5e03",
        kind: "alcohol",
        name: "IPA",
        volume_ml: 355,
        abv: 6.5,
        consumed_at: ms("2026-09-27T19:40:00.000Z"),
        updated_at: ms("2026-09-27T21:00:00.000Z"),
        revision: 2,
        synced_revision: 1,
      }),
      // Tombstones: one already removed from Health, one never written there.
      drink({
        id: "0b3f6a52-7c1e-4d8a-9f20-1a2b3c4d5e04",
        kind: "tea",
        volume_ml: 240,
        caffeine_mg: 47,
        consumed_at: ms("2026-09-28T10:00:00.000Z"),
        revision: 2,
        deleted: 1,
        synced_revision: 2,
      }),
      drink({
        id: "0b3f6a52-7c1e-4d8a-9f20-1a2b3c4d5e05",
        kind: "juice",
        volume_ml: 240,
        consumed_at: ms("2026-09-28T12:00:00.000Z"),
        revision: 2,
        deleted: 1,
      }),
      // Not written to Health yet.
      drink({
        id: "0b3f6a52-7c1e-4d8a-9f20-1a2b3c4d5e06",
        kind: "water",
        volume_ml: 500,
        consumed_at: ms("2026-09-28T13:15:00.000Z"),
      }),
      drink({
        id: "0b3f6a52-7c1e-4d8a-9f20-1a2b3c4d5e07",
        kind: "energy",
        name: "Monster Ultra 🧃",
        volume_ml: 473,
        caffeine_mg: 150,
        consumed_at: ms("2026-09-28T15:00:00.000Z"),
      }),
      drink({
        id: "0b3f6a52-7c1e-4d8a-9f20-1a2b3c4d5e08",
        kind: "other",
        name: "ماء بالليمون",
        volume_ml: 300,
        consumed_at: ms("2026-09-28T18:20:00.000Z"),
        synced_revision: 1,
      }),
      // Logged on Apple Watch: the queue keeps the id the watch made.
      drink({
        id: "6e2d8c41-9b7a-4f3e-a5d1-2c8b7e6f0a19",
        kind: "milk",
        volume_ml: 240,
        consumed_at: ms("2026-09-28T21:00:00.000Z"),
      }),
    ]);
    db.runSync(
      "INSERT INTO counters (id, value) VALUES (1, 3) ON CONFLICT(id) DO UPDATE SET value = excluded.value"
    );
    const preferences = {
      id: 1,
      language: "fr",
      appearance: "dark",
      units: "us",
      goal_ml: 2800,
      default_ml: 236.5882365,
      quick_ml: 355,
      favorites: json([
        { id: "water", kind: "water", name: "", ml: 250, caffeine: 0, abv: 0 },
        {
          id: "drip-coffee",
          kind: "coffee",
          name: "Drip coffee",
          ml: 240,
          caffeine: 95,
          abv: 0,
          showOnHome: true,
        },
        {
          id: "5d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
          kind: "other",
          name: "Kombucha",
          ml: 330,
          caffeine: 8,
          abv: 0.5,
          color: "teal",
        },
      ]),
      weight_kg: 72.5,
      bac_enabled: 1,
      body_water_ratio: 0.58,
      reminder_schedule: json([
        { wake: 540, bed: 1380, off: true },
        { wake: 390, bed: 1320 },
        { wake: 390, bed: 1320 },
        { wake: 390, bed: 1320 },
        { wake: 390, bed: 1320 },
        { wake: 390, bed: 1350 },
        { wake: 540, bed: 1410 },
      ]),
      reminder_morning_glasses: 2,
      reminder_wind_down: 90,
      reminder_description: "Weekdays at the office, weekends slower",
      // Device state: never exported.
      health_enabled: 1,
      last_sync: ms("2026-09-28T18:30:00.000Z"),
      health_weight_kg: 72.1,
      health_weight_at: ms("2026-09-26T06:30:00.000Z"),
      health_error: null,
      health_bac_fingerprint: "0.012:1790541600000",
      reminders_enabled: 1,
    };
    const columns = Object.keys(preferences);
    db.runSync(
      `INSERT INTO preferences (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")}) ON CONFLICT(id) DO UPDATE SET ${columns
        .filter((c) => c !== "id")
        .map((c) => `${c} = excluded.${c}`)
        .join(", ")}`,
      columns.map((c) => preferences[c])
    );
  });
}

/** React is never rendered in Node: provider.tsx only needs the names to exist. */
const noReact = { react: {}, "react/jsx-runtime": {} };

module.exports = {
  levels: [FIRST_LEVEL],
  seed,
  // Modules the descriptor imports lazily; each world records the calls (`w.called(module)`).
  stubs: {
    // The real initializeDatabase (WAL, foreign keys, migrations, the preferences and counters rows).
    "@/db/provider": (w) => w.load("src/db/provider.tsx", noReact),
    "@/lib/watch": (w) =>
      w.record("@/lib/watch", { saveQueuedDrinks: () => {}, resendWatchState: () => {} }),
    "@/lib/health": (w) =>
      w.record("@/lib/health", {
        pauseWhenIdle: (work) => work(),
        unregisterBackgroundSync: async () => {},
      }),
  },
};
