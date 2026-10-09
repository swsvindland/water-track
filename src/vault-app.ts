// Pendum Hydration's vault descriptor (docs/vault.md §2): what a backup holds, how a restore treats device state
// and drinks Health may hold that the backup lacks, and the app's hooks around both. It must load in Node:
// modules that reach native code, React or the live database are imported inside the functions that use them.
import type { DescribeContext, SummaryValues, VaultApp, VaultIssue } from "@/vault/types";
import { csvFile } from "@/vault/engine/csv";
import { countWhere, notIn } from "@/vault/engine/db";
import * as schema from "@/db/schema";
import { savedFavorites } from "@/lib/favorites";
import { interpolate, translate } from "@/lib/i18n";
import { kinds, OZ_ML } from "@/lib/metrics";
import { parseSchedule } from "@/lib/reminders";

import migrations from "../drizzle/migrations";

const DATABASE = "water-track.db";
/** Drink ids are UUIDs; watch and reminder entries use the same characters (quick-log.ts). */
const DRINK_ID = /^[\w-]{1,64}$/;

/** "{n} drinks" / "{n} drink" by the language's plural rule; nothing for zero. */
function drinkCount(value: SummaryValues[string], ctx: DescribeContext): string[] {
  const n = Number(value ?? 0);
  if (!(n > 0)) return [];
  const key = ctx.plural(n) === "one" ? "vaultDrinkCountOne" : "vaultDrinkCount";
  return [interpolate(translate(ctx.language, key), { n: ctx.number(n) })];
}

const pad = (n: number) => String(n).padStart(2, "0");

export const vaultApp: VaultApp = {
  id: "water",
  database: {
    name: "water-track.db",
    // A connection of its own without the change listener, so a restore of thousands of drinks does not re-run the
    // live queries once per row. initializeDatabase sets the busy timeout every connection of the app uses.
    acquire: async () => {
      const [{ openDatabaseAsync }, { initializeDatabase }] = await Promise.all([
        import("expo-sqlite"),
        import("@/db/provider"),
      ]);
      const db = await openDatabaseAsync(DATABASE, {
        useNewConnection: true,
        enableChangeListener: false,
      });
      await initializeDatabase(db);
      return db;
    },
    release: (db) => db.closeAsync(),
    // Wakes the live queries once per table after a restore. SQLite's update hook, which drives them, reports a
    // changed row as it is written: same-value updates of device columns are reported without changing anything a
    // backup counts, and an empty drinks table gets an insert that is rolled back, leaving no row behind.
    announceChange: async () => {
      const { openDatabaseAsync } = await import("expo-sqlite");
      const db = await openDatabaseAsync(DATABASE, {
        useNewConnection: true,
        enableChangeListener: true,
      });
      try {
        db.execSync("PRAGMA busy_timeout = 5000");
        db.runSync("UPDATE preferences SET last_sync = last_sync WHERE id = 1");
        const last = db.getFirstSync<{ r: number | null }>("SELECT max(rowid) AS r FROM drinks")?.r;
        if (last != null)
          db.runSync("UPDATE drinks SET synced_revision = synced_revision WHERE rowid = ?", [last]);
        else {
          db.execSync("BEGIN");
          try {
            db.runSync(
              "INSERT INTO drinks (id, kind, volume_ml, consumed_at, updated_at, deleted) VALUES ('__vault_nudge', 'water', 1, 0, 0, 1)"
            );
          } finally {
            db.execSync("ROLLBACK");
          }
        }
      } finally {
        await db.closeAsync();
      }
    },
  },
  migrations,
  tables: [
    // The template's single counter row: kept so nothing disappears; initializeDatabase writes it on every open.
    { name: "counters", mode: "replace", role: "settings" },
    { name: "drinks", mode: "replace", role: "data", deviceColumns: ["synced_revision"] },
    {
      name: "preferences",
      mode: "singleton",
      role: "settings",
      singleton: { idColumn: "id", where: '"id" = 1' },
      // Health and reminders depend on this device's permissions; the cached Health weight never leaves it.
      deviceColumns: [
        "health_enabled",
        "last_sync",
        "health_weight_kg",
        "health_weight_at",
        "health_error",
        "health_bac_fingerprint",
        "reminders_enabled",
      ],
    },
  ],
  summary: {
    drinks: "SELECT count(*) AS v FROM drinks WHERE deleted = 0",
    first: "SELECT min(consumed_at) AS v FROM drinks WHERE deleted = 0",
    latest:
      "SELECT strftime('%Y-%m-%dT%H:%M:%fZ', max(consumed_at) / 1000.0, 'unixepoch') AS v FROM drinks WHERE deleted = 0",
  },
  describe: (values, ctx) => [
    ...drinkCount(values.drinks, ctx),
    ...(values.first == null
      ? []
      : [interpolate(translate(ctx.language, "vaultSince"), { date: ctx.date(values.first) })]),
  ],
  // Tombstones and the counters row are not user records.
  emptySql: "SELECT NOT EXISTS (SELECT 1 FROM drinks WHERE deleted = 0) AS v",
  csv: async (snapshot) => {
    const drinks = snapshot.getAllSync<{
      consumed_at: number;
      kind: string;
      name: string | null;
      volume_ml: number;
      caffeine_mg: number;
      abv: number;
    }>(
      "SELECT consumed_at, kind, name, volume_ml, caffeine_mg, abv FROM drinks WHERE deleted = 0 ORDER BY consumed_at"
    );
    const rows = drinks.map((d) => {
      // Local date and time in the device's time zone at export.
      const at = new Date(d.consumed_at);
      return [
        at.toISOString(),
        [at.getFullYear(), pad(at.getMonth() + 1), pad(at.getDate())].join("-"),
        [pad(at.getHours()), pad(at.getMinutes())].join(":"),
        d.kind,
        d.name,
        d.volume_ml,
        (d.volume_ml / OZ_ML).toFixed(1),
        d.caffeine_mg,
        d.abv,
      ];
    });
    const header = [
      "consumed_at_utc",
      "local_date",
      "local_time",
      "kind",
      "name",
      "volume_ml",
      "volume_fl_oz",
      "caffeine_mg",
      "abv",
    ];
    return [{ name: "drinks.csv", text: csvFile([header, ...rows]) }];
  },
  validate(db) {
    const issues: VaultIssue[] = [];
    const preferences = db.getAllSync<{ favorites: string; reminder_schedule: string }>(
      "SELECT favorites, reminder_schedule FROM preferences WHERE id = 1"
    );
    if (preferences.length !== 1)
      issues.push({ table: "preferences", fatal: true, message: "count:singleton" });
    for (const row of preferences) {
      // Home parses the favorites without a guard.
      try {
        savedFavorites(row.favorites);
      } catch {
        issues.push({ table: "preferences", fatal: true, message: "json:favorites" });
      }
      // The reminder screens fall back to the default day, so a broken schedule is only reported.
      if (parseSchedule(row.reminder_schedule).length !== 7)
        issues.push({ table: "preferences", fatal: false, message: "value:reminder_schedule" });
    }
    if (countWhere(db, "drinks", notIn("kind", kinds)) > 0)
      issues.push({ table: "drinks", fatal: true, message: "value:kind" });
    if (db.getAllSync<{ id: string }>("SELECT id FROM drinks").some((d) => !DRINK_ID.test(d.id)))
      issues.push({ table: "drinks", fatal: true, message: "value:id" });
    return issues;
  },
  swap: (ctx) => ({
    // Every drink the archive lacks, deleted ones included, comes back as a tombstone, so the reconnect backfill
    // deletes its samples instead of orphaning them: no column says Health holds none. synced_revision 0 does not
    // mean "not in Health": with one write type denied, write() saves the allowed samples and still reports false,
    // and a restore resets the column, so a second restore before reconnecting would drop drinks Health still holds.
    // An acknowledged deletion does not mean it either: synced_revision covers the drink's own samples, while its
    // BAC estimate is deleted later by the BAC pass, which the restore's pause or one failed write leaves unfinished
    // (health_bac_fingerprint, reset by the restore, makes the reconnect run that pass again). A drink with nothing
    // left in Health costs one delete that matches nothing. When the archive has no drinks table at all, the live
    // rows are kept as they are and the insert leaves them alone.
    before: [
      {
        sql: "CREATE TEMP TABLE _vault_carry AS SELECT * FROM main.drinks d WHERE NOT EXISTS (SELECT 1 FROM incoming.drinks i WHERE i.id = d.id)",
      },
    ],
    after: [
      {
        sql: "INSERT INTO main.drinks (id, kind, name, volume_ml, caffeine_mg, abv, consumed_at, updated_at, revision, deleted) SELECT id, kind, name, volume_ml, caffeine_mg, abv, consumed_at, ?, revision + 1, 1 FROM temp._vault_carry WHERE 1 ON CONFLICT(id) DO NOTHING",
        params: [ctx.now.getTime()],
      },
    ],
  }),
  deviceOverrides: () => [
    {
      sql: "UPDATE preferences SET health_enabled = 0, last_sync = NULL, health_error = NULL, health_bac_fingerprint = NULL WHERE id = 1",
    },
  ],
  healthEnabledSql: "SELECT health_enabled AS v FROM preferences WHERE id = 1",
  hooks: {
    pauseWhenIdle: async (work, ms) => (await import("@/lib/health")).pauseWhenIdle(work, ms),
    // Drinks logged on Apple Watch or from a reminder wait in a native queue; saving them first puts them in the
    // backup (and in the recovery set of a restore).
    beforeExport: async (db) => {
      const [{ drizzle }, { saveQueuedDrinks }] = await Promise.all([
        import("drizzle-orm/expo-sqlite"),
        import("@/lib/watch"),
      ]);
      saveQueuedDrinks(drizzle(db, { schema }));
    },
    afterRestore: async () => {
      // Health is off after every restore; the store's effects re-arm reminders from the restored preferences.
      await (await import("@/lib/health")).unregisterBackgroundSync().catch(() => {});
      (await import("@/lib/watch")).resendWatchState();
    },
  },
  backgroundIntervalMinutes: 15,
  excludedTables: [],
};
