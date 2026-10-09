// Pendum Hydration's own vault tests (app-owned; the generic ones are tests/vault/*.cjs through tests/vault.test.mjs).
// They run the vault's real TypeScript, src/vault-app.ts and the real src/lib/health.ts (with mock Health adapters)
// in harness worlds: drinks a restore takes from the archive, drinks Health may hold that it lacks, device state,
// the validators, the live-query nudge, the Settings restore key, the Health pause, and a backup's preview phrases
// and CSV.
import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import fs from "node:fs";
import { createRequire } from "node:module";

const vault = createRequire(import.meta.url)("./vault-harness.cjs");
const { skip } = vault;
const languages = ["en", "es", "fr", "de", "it", "pt", "nl", "sv", "ja", "ko", "zh"];

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/**
 * A Health adapter double for the real src/lib/health.ts: records every drink written, and while `gate` is set,
 * holds the sync in its weight read (telling `reading` it got there).
 */
function healthMock() {
  const mock = { writes: [], gate: null, reading: null };
  mock.native = {
    healthAvailable: true,
    healthAdapter: async () => ({
      readWeight: async () => {
        mock.reading?.resolve();
        if (mock.gate) await mock.gate.promise;
        return undefined;
      },
      write: async (drink) => {
        mock.writes.push(drink);
        return true;
      },
      writeBac: undefined,
    }),
  };
  return mock;
}

/**
 * A Health store double that behaves like src/lib/health-native.ts on iOS: a drink is up to three samples (water,
 * caffeine, standard drinks) and a BAC estimate, each found by the drink's id. A write replaces the sample of every
 * allowed type (delete, then save when the value is above 0); a denied type is skipped and makes the write report
 * false after the allowed samples were saved. While `bacGate` is set, the BAC write of its `id` waits for `release`
 * (telling `reached` it got there).
 */
function healthStore({ denied = [] } = {}) {
  const store = { samples: new Map(), bacGate: null };
  const replace = (type, id, value) => {
    if (denied.includes(type)) return false;
    store.samples.delete(`${type} ${id}`);
    if (value !== null && value > 0) store.samples.set(`${type} ${id}`, value);
    return true;
  };
  store.native = (w) => {
    const { healthDrinkValues } = w.load("src/lib/health-data.ts");
    return {
      healthAvailable: true,
      healthAdapter: async () => ({
        readWeight: async () => undefined,
        write: async (d) => {
          const values = healthDrinkValues(d);
          const written = [
            replace("water", d.id, values.waterMl),
            replace("caffeine", d.id, values.caffeineMg),
            replace("alcohol", d.id, values.standardDrinks),
          ];
          return written.every(Boolean);
        },
        writeBac: async (id, fraction) => {
          const drinkId = id.replace(/^water-track:bac:/, "");
          const gate = store.bacGate;
          if (gate?.id === drinkId) {
            store.bacGate = null;
            gate.reached.resolve();
            await gate.release.promise;
          }
          return replace("bac", drinkId, fraction);
        },
      }),
    };
  };
  return store;
}

/** A world closed after the test; with `health`, @/lib/health is the real module over that mock. */
async function open(t, { health, ...options } = {}) {
  const stubs = health
    ? { "@/lib/health": (w) => w.load("src/lib/health.ts", { "./health-native": health.native }) }
    : {};
  const w = await vault.world({ ...options, stubs });
  t.after(async () => {
    // A failed sync arms a retry timer (30 s and longer) that would keep the test process alive: one more sync
    // with Health off clears it.
    if (health) {
      health.gate?.resolve();
      (await w.live()).runSync("UPDATE preferences SET health_enabled = 0 WHERE id = 1");
      await w
        .require("@/lib/health")
        .syncHealth()
        .catch(() => {});
    }
    await w.close();
  });
  return {
    w,
    app: w.vaultApp,
    File: w.require("expo-file-system").File,
    ops: w.require("@/vault/ops"),
    paths: w.require("@/vault/engine/paths"),
  };
}

/** The live database seeded with the fixture (a long-time user with Health sync on). */
async function seeded(t, options) {
  const ctx = await open(t, options);
  const db = await ctx.w.live();
  ctx.w.seed(db);
  return { ...ctx, db };
}

/** A manual export into Documents/out/<name>. */
async function exportTo(ctx, name) {
  fs.mkdirSync(ctx.w.file("out"), { recursive: true });
  const result = await ctx.ops.runExport({
    kind: "manual",
    destination: new ctx.File(ctx.w.uri("out", name)),
    embedMedia: true,
    csv: false,
    deflateLevel: 6,
  });
  return result.file;
}

/** The archive file of one world handed to another (Documents/in/<name>). */
function carry(from, to, file, name) {
  fs.mkdirSync(to.w.file("in"), { recursive: true });
  fs.copyFileSync(from.paths.fsPath(file), to.w.file("in", name));
  return new to.File(to.w.uri("in", name));
}

/** The archive without one table's data, as an app version whose descriptor did not list it would write it. */
function withoutTable(ctx, from, name, table) {
  const { unzipSync, zipSync } = ctx.w.require("fflate");
  const entries = unzipSync(new Uint8Array(fs.readFileSync(ctx.paths.fsPath(from))));
  const manifest = JSON.parse(Buffer.from(entries["manifest.json"]).toString("utf8"));
  delete entries[`data/${table}.ndjson`];
  manifest.tables = manifest.tables.filter((t) => t.name !== table);
  entries["manifest.json"] = new Uint8Array(Buffer.from(JSON.stringify(manifest)));
  fs.writeFileSync(ctx.w.file("out", name), zipSync(entries));
  return new ctx.File(ctx.w.uri("out", name));
}

/** Open, then restore, as the import screen does. */
async function restoreFrom(ctx, file) {
  const archive = await ctx.ops.runOpen(file);
  try {
    return await ctx.ops.runRestore(archive, { reason: "file" });
  } finally {
    archive.close();
  }
}

/** The VaultError `fn` rejects with. */
async function vaultError(fn) {
  try {
    await fn();
  } catch (e) {
    if (e?.name === "VaultError") return e;
    throw e;
  }
  assert.fail("expected a VaultError");
}

/** SHA-256 of a VACUUM INTO copy: equal when the database did not change. */
function snapshot(ctx, db) {
  const file = ctx.w.file(`copy-${Date.now()}-${Math.random()}.db`);
  db.runSync("VACUUM INTO ?", [file]);
  try {
    return fs.readFileSync(file).toString("base64");
  } finally {
    fs.rmSync(file, { force: true });
  }
}

const drink = (db, row) => {
  const values = {
    name: null,
    caffeine_mg: 0,
    abv: 0,
    revision: 1,
    deleted: 0,
    synced_revision: 0,
    updated_at: row.consumed_at,
    ...row,
  };
  const columns = Object.keys(values);
  db.runSync(
    `INSERT INTO drinks (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    columns.map((c) => values[c])
  );
};

const preferences = (db) => db.getFirstSync("SELECT * FROM preferences WHERE id = 1");
const drinks = (db) => db.getAllSync("SELECT * FROM drinks ORDER BY id");
const tombstones = (db) =>
  db
    .getAllSync("SELECT id, revision, synced_revision FROM drinks WHERE deleted = 1 ORDER BY id")
    .map((d) => [d.id, d.revision, d.synced_revision]);

/** Settings' Connect switch: every drink queued again and Health on, then the sync the app's store starts. */
function reconnect(ctx, db) {
  db.runSync("UPDATE drinks SET synced_revision = 0");
  db.runSync(
    "UPDATE preferences SET health_enabled = 1, health_error = NULL, health_bac_fingerprint = NULL WHERE id = 1"
  );
  return ctx.w.require("@/lib/health").syncHealth();
}

/** Samples of drinks the app no longer shows: nothing could ever remove them from Health. */
function orphans(store, db) {
  const live = new Set(db.getAllSync("SELECT id FROM drinks WHERE deleted = 0").map((d) => d.id));
  return [...store.samples.keys()].filter((key) => !live.has(key.split(" ")[1])).sort();
}

test(
  "every connection the app opens waits for another writer (busy_timeout)",
  { skip },
  async (t) => {
    const ctx = await open(t);
    const live = await ctx.w.live();
    assert.equal(live.getFirstSync("PRAGMA busy_timeout").timeout, 5000);
    const db = await ctx.app.database.acquire();
    try {
      assert.equal(db.getFirstSync("PRAGMA busy_timeout").timeout, 5000);
    } finally {
      await ctx.app.database.release(db);
    }
  }
);

test(
  "restore on another phone: drinks arrive unsynced, every drink the file lacks becomes a tombstone, Health is off and reconnecting deletes them there",
  { skip },
  async (t) => {
    const a = await seeded(t);
    const archived = drinks(a.db);
    const file = await exportTo(a, "a.pendumwater");

    const health = healthMock();
    const b = await open(t, { health });
    const db = await b.w.live();
    const logged = Date.parse("2026-10-01T09:00:00.000Z");
    // Already in Health on this phone, missing from the file.
    drink(db, {
      id: "b-sent",
      kind: "coffee",
      volume_ml: 240,
      caffeine_mg: 95,
      consumed_at: logged,
      revision: 3,
      synced_revision: 3,
    });
    // Never acknowledged, missing from the file: Health may still hold it (a write with a type denied saves the
    // allowed samples and reports false), so it is carried too; if it never got there, the delete matches nothing.
    drink(db, { id: "b-unsent", kind: "water", volume_ml: 500, consumed_at: logged + 60_000 });
    // A deletion Health acknowledged: its drink samples are gone, but the BAC pass deletes the BAC estimate later and
    // may not have yet, so it is carried too.
    drink(db, {
      id: "b-gone",
      kind: "tea",
      volume_ml: 240,
      consumed_at: logged + 120_000,
      revision: 2,
      deleted: 1,
      synced_revision: 2,
    });
    // The file's own drink, sent from this phone at another revision.
    drink(db, { ...archived[0], volume_ml: 999, revision: 7, synced_revision: 7 });
    db.runSync(
      "UPDATE preferences SET health_enabled = 1, last_sync = 1, health_error = 'healthError', health_bac_fingerprint = '[]', health_weight_kg = 81.5, health_weight_at = 2, reminders_enabled = 1 WHERE id = 1"
    );
    const started = Date.now();
    await restoreFrom(b, carry(a, b, file, "a.pendumwater"));

    const rows = drinks(db);
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const row of archived)
      assert.deepEqual(
        byId.get(row.id),
        { ...row, synced_revision: 0 },
        `${row.id} as archived, unsynced`
      );
    const sent = byId.get("b-sent");
    assert.equal(sent.deleted, 1);
    assert.equal(sent.revision, 4);
    assert.equal(sent.synced_revision, 0);
    assert.ok(sent.updated_at >= started);
    assert.deepEqual(
      [sent.kind, sent.volume_ml, sent.caffeine_mg, sent.consumed_at],
      ["coffee", 240, 95, logged]
    );
    const unsent = byId.get("b-unsent");
    assert.deepEqual(
      [unsent.deleted, unsent.revision, unsent.synced_revision, unsent.volume_ml],
      [1, 2, 0, 500],
      "a drink Health never acknowledged is a hidden tombstone"
    );
    const gone = byId.get("b-gone");
    assert.deepEqual(
      [gone.deleted, gone.revision, gone.synced_revision, gone.volume_ml],
      [1, 3, 0, 240],
      "a deletion Health acknowledged stays a tombstone"
    );
    assert.equal(rows.length, archived.length + 3);

    const prefs = preferences(db);
    assert.deepEqual(
      [prefs.health_enabled, prefs.last_sync, prefs.health_error, prefs.health_bac_fingerprint],
      [0, null, null, null],
      "Health sync is off"
    );
    assert.equal(prefs.reminders_enabled, 1, "the reminders switch stays this phone's");
    assert.deepEqual(
      [prefs.health_weight_kg, prefs.health_weight_at],
      [81.5, 2],
      "the Health weight stays this phone's"
    );
    assert.deepEqual(
      [prefs.language, prefs.goal_ml, prefs.units],
      ["fr", 2800, "us"],
      "settings come from the file"
    );

    // Reconnecting (Settings' Connect switch) backfills everything; the carried tombstones delete their samples.
    await reconnect(b, db);
    const { healthDrinkValues } = b.w.load("src/lib/health-data.ts");
    for (const id of ["b-sent", "b-unsent", "b-gone"]) {
      const write = health.writes.find((d) => d.id === id);
      assert.equal(write.deleted, true, id);
      assert.deepEqual(
        healthDrinkValues(write),
        { waterMl: 0, caffeineMg: 0, standardDrinks: 0 },
        id
      );
    }
    assert.deepEqual(health.writes.map((d) => d.id).sort(), rows.map((r) => r.id).sort());
  }
);

// The ways a drink can be in Health while synced_revision does not say so (M1 review): partial permission, two
// restores before reconnecting, a deletion Health has not acknowledged, and an acknowledged deletion whose BAC estimate
// the BAC pass has not deleted yet. Each restore is the phone's own backup; each test ends with Health reconnected
// and no sample left for a drink the app no longer has.
const morning = Date.parse("2026-10-01T09:00:00.000Z");
const hour = 3_600_000;

test(
  "partial Health permission: drinks written with a type denied are never acknowledged, and a restore that lacks them still leaves no sample behind",
  { skip },
  async (t) => {
    const health = healthStore({ denied: ["alcohol"] });
    const ctx = await open(t, { health });
    const db = await ctx.w.live();
    db.runSync("UPDATE preferences SET bac_enabled = 1, weight_kg = 70 WHERE id = 1");
    drink(db, { id: "kept", kind: "water", volume_ml: 250, consumed_at: morning });
    await assert.rejects(reconnect(ctx, db), /partial/);
    const older = await exportTo(ctx, "older.pendumwater");
    // Logged after the backup and written with Alcoholic Beverages denied: water, caffeine and BAC got there.
    drink(db, {
      id: "coffee",
      kind: "coffee",
      volume_ml: 240,
      caffeine_mg: 95,
      consumed_at: morning + hour,
    });
    drink(db, {
      id: "beer",
      kind: "alcohol",
      volume_ml: 355,
      abv: 5,
      consumed_at: morning + 2 * hour,
    });
    await assert.rejects(ctx.w.require("@/lib/health").syncHealth(), /partial/);
    assert.deepEqual([...health.samples.keys()].sort(), [
      "bac beer",
      "caffeine coffee",
      "water coffee",
      "water kept",
    ]);
    assert.deepEqual(
      db.getAllSync("SELECT DISTINCT synced_revision AS s FROM drinks"),
      [{ s: 0 }],
      "no write was acknowledged"
    );

    await restoreFrom(ctx, older);
    assert.deepEqual(tombstones(db), [
      ["beer", 2, 0],
      ["coffee", 2, 0],
    ]);
    await assert.rejects(reconnect(ctx, db), /partial/, "Alcoholic Beverages is still denied");
    assert.deepEqual(orphans(health, db), []);
    assert.deepEqual([...health.samples.keys()], ["water kept"]);
  }
);

test(
  "two restores before Health is reconnected: drinks still in Health that the second file lacks are carried, though the first restore reset their synced_revision",
  { skip },
  async (t) => {
    const health = healthStore();
    const ctx = await open(t, { health });
    const db = await ctx.w.live();
    drink(db, { id: "first", kind: "water", volume_ml: 250, consumed_at: morning });
    await reconnect(ctx, db);
    const older = await exportTo(ctx, "older.pendumwater");
    drink(db, {
      id: "second",
      kind: "tea",
      volume_ml: 240,
      caffeine_mg: 47,
      consumed_at: morning + hour,
    });
    await ctx.w.require("@/lib/health").syncHealth();
    const newer = await exportTo(ctx, "newer.pendumwater");
    assert.deepEqual([...health.samples.keys()].sort(), [
      "caffeine second",
      "water first",
      "water second",
    ]);

    await restoreFrom(ctx, newer);
    assert.deepEqual(
      db.getAllSync("SELECT id, synced_revision AS s FROM drinks ORDER BY id"),
      [
        { id: "first", s: 0 },
        { id: "second", s: 0 },
      ],
      "restored drinks arrive unsynced"
    );
    await restoreFrom(ctx, older);
    assert.deepEqual(tombstones(db), [["second", 2, 0]]);
    await reconnect(ctx, db);
    assert.deepEqual(orphans(health, db), []);
    assert.deepEqual([...health.samples.keys()], ["water first"]);
  }
);

test(
  "a tombstone the first restore carried is carried again by a second restore before Health is reconnected",
  { skip },
  async (t) => {
    const health = healthStore();
    const ctx = await open(t, { health });
    const db = await ctx.w.live();
    drink(db, { id: "first", kind: "water", volume_ml: 250, consumed_at: morning });
    await reconnect(ctx, db);
    const older = await exportTo(ctx, "older.pendumwater");
    drink(db, { id: "later", kind: "juice", volume_ml: 300, consumed_at: morning + hour });
    await ctx.w.require("@/lib/health").syncHealth();

    await restoreFrom(ctx, older);
    assert.deepEqual(tombstones(db), [["later", 2, 0]]);
    // The same file once more (or the undo of a later restore), Health still off.
    await restoreFrom(ctx, older);
    assert.deepEqual(tombstones(db), [["later", 3, 0]]);
    await reconnect(ctx, db);
    assert.deepEqual(orphans(health, db), []);
    assert.deepEqual([...health.samples.keys()], ["water first"]);
  }
);

test(
  "a deletion Health has not acknowledged yet is carried by a restore that lacks the drink",
  { skip },
  async (t) => {
    const health = healthStore();
    const ctx = await open(t, { health });
    const db = await ctx.w.live();
    drink(db, { id: "first", kind: "water", volume_ml: 250, consumed_at: morning });
    await reconnect(ctx, db);
    const older = await exportTo(ctx, "older.pendumwater");
    drink(db, {
      id: "gone",
      kind: "coffee",
      volume_ml: 240,
      caffeine_mg: 95,
      consumed_at: morning + hour,
    });
    await ctx.w.require("@/lib/health").syncHealth();
    // Deleted while Health was disconnected (or its sync failing), as drink.tsx deletes: a tombstone at the next
    // revision that Health never received.
    db.runSync("UPDATE preferences SET health_enabled = 0 WHERE id = 1");
    db.runSync(
      "UPDATE drinks SET deleted = 1, revision = revision + 1, updated_at = ? WHERE id = 'gone'",
      [morning + 2 * hour]
    );
    assert.deepEqual(tombstones(db), [["gone", 2, 1]]);

    await restoreFrom(ctx, older);
    assert.deepEqual(tombstones(db), [["gone", 3, 0]]);
    await reconnect(ctx, db);
    assert.deepEqual(orphans(health, db), []);
    assert.deepEqual([...health.samples.keys()], ["water first"]);
  }
);

/**
 * A phone with BAC estimates on: "first" is in Health and in the `older` backup; then a beer is logged, sent with
 * its BAC estimate, and deleted as drink.tsx deletes (a tombstone at revision 2 that Health has not received yet).
 */
async function beerDeletedAfterBackup(t, health) {
  const ctx = await open(t, { health });
  const db = await ctx.w.live();
  db.runSync("UPDATE preferences SET bac_enabled = 1, weight_kg = 70 WHERE id = 1");
  drink(db, { id: "first", kind: "water", volume_ml: 250, consumed_at: morning });
  await reconnect(ctx, db);
  const older = await exportTo(ctx, "older.pendumwater");
  drink(db, { id: "beer", kind: "alcohol", volume_ml: 355, abv: 5, consumed_at: morning + hour });
  await ctx.w.require("@/lib/health").syncHealth();
  assert.deepEqual([...health.samples.keys()].sort(), ["alcohol beer", "bac beer", "water first"]);
  db.runSync(
    "UPDATE drinks SET deleted = 1, revision = revision + 1, updated_at = ? WHERE id = 'beer'",
    [morning + 2 * hour]
  );
  return { ...ctx, db, older };
}

test(
  "a deletion Health acknowledged is carried while the BAC pass has not deleted its estimate: a restore that pauses the sync between the two leaves no sample behind",
  { skip },
  async (t) => {
    const health = healthStore();
    const ctx = await beerDeletedAfterBackup(t, health);
    const { db } = ctx;
    const sync = ctx.w.require("@/lib/health");
    // The sync the deletion starts sends it, then its BAC pass waits on the drink before the beer.
    const gate = { id: "first", reached: deferred(), release: deferred() };
    health.bacGate = gate;
    const running = sync.syncHealth();
    await gate.reached.promise;
    assert.deepEqual(tombstones(db), [["beer", 2, 2]], "Health acknowledged the deletion");
    assert.deepEqual([...health.samples.keys()].sort(), ["bac beer", "water first"]);

    // The restore holds Health sync off, then waits for the running sync, which stops at its next step.
    const pause = sync.pauseWhenIdle;
    const holding = deferred();
    t.mock.method(sync, "pauseWhenIdle", (work, ms) => {
      const held = pause(work, ms);
      holding.resolve();
      return held;
    });
    const restoring = restoreFrom(ctx, ctx.older);
    await holding.promise;
    gate.release.resolve();
    await running;
    await restoring;
    assert.deepEqual(
      [...health.samples.keys()].sort(),
      ["bac beer", "water first"],
      "the sync stopped before the BAC delete"
    );
    assert.deepEqual(tombstones(db), [["beer", 3, 0]]);
    await reconnect(ctx, db);
    assert.deepEqual(orphans(health, db), []);
    assert.deepEqual([...health.samples.keys()], ["water first"]);
  }
);

test(
  "a deletion Health acknowledged whose BAC delete failed is carried by a restore before the retry, and reconnecting deletes the estimate",
  { skip },
  async (t) => {
    const denied = [];
    const health = healthStore({ denied });
    const ctx = await beerDeletedAfterBackup(t, health);
    const { db } = ctx;
    // Blood Alcohol Content write access revoked while Alcoholic Beverages stays allowed.
    denied.push("bac");
    await assert.rejects(ctx.w.require("@/lib/health").syncHealth(), /partial/);
    assert.deepEqual(tombstones(db), [["beer", 2, 2]], "Health acknowledged the deletion");
    assert.deepEqual([...health.samples.keys()].sort(), ["bac beer", "water first"]);

    await restoreFrom(ctx, ctx.older);
    assert.deepEqual(tombstones(db), [["beer", 3, 0]]);
    // Access granted again with the reconnect.
    denied.length = 0;
    await reconnect(ctx, db);
    assert.deepEqual(orphans(health, db), []);
    assert.deepEqual([...health.samples.keys()], ["water first"]);
  }
);

test(
  "a file without the drinks table keeps this phone's drinks as they are, Health state included",
  { skip },
  async (t) => {
    const ctx = await seeded(t);
    const { db } = ctx;
    const file = await exportTo(ctx, "full.pendumwater");
    const partial = withoutTable(ctx, file, "no-drinks.pendumwater", "drinks");
    // Since the export, every drink was sent to Health and one more was logged and sent.
    db.runSync("UPDATE drinks SET synced_revision = revision");
    drink(db, {
      id: "after-export",
      kind: "tea",
      volume_ml: 240,
      consumed_at: Date.parse("2026-10-02T08:00:00.000Z"),
      synced_revision: 1,
    });
    db.runSync("UPDATE preferences SET goal_ml = 1234 WHERE id = 1");
    const kept = drinks(db);
    await restoreFrom(ctx, partial);
    assert.deepEqual(drinks(db), kept);
    assert.equal(preferences(db).goal_ml, 2800, "the file's other tables are restored");
  }
);

test(
  "favorites Home cannot read and drink kinds the app does not know refuse the restore (invalidData), leaving everything as it was",
  { skip },
  async (t) => {
    const cases = {
      favorites: 'UPDATE preferences SET favorites = \'[{"id":"water"\' WHERE id = 1',
      kind: "UPDATE drinks SET kind = 'lava' WHERE rowid = (SELECT min(rowid) FROM drinks)",
    };
    for (const [label, corrupt] of Object.entries(cases)) {
      const a = await seeded(t);
      a.db.runSync(corrupt);
      const file = await exportTo(a, `${label}.pendumwater`);
      const b = await seeded(t);
      const archive = await b.ops.runOpen(carry(a, b, file, `${label}.pendumwater`));
      try {
        const before = snapshot(b, b.db);
        // The refused restore is reported once for diagnostics (ops.ts); nothing else may be.
        const warned = [];
        const warn = t.mock.method(console, "warn", (...args) => warned.push(args));
        const error = await vaultError(() => b.ops.runRestore(archive, { reason: "file" }));
        warn.mock.restore();
        assert.equal(error.code, "invalidData", label);
        assert.deepEqual(
          warned.map((args) => args.slice(0, 2)),
          [["[vault]", "invalidData"]],
          label
        );
        assert.equal(snapshot(b, b.db), before, `${label}: nothing changed`);
      } finally {
        archive.close();
      }
    }
  }
);

test("validators: only what would crash the app is fatal", { skip }, async (t) => {
  const { app, db } = await seeded(t);
  const issues = () =>
    app.validate(db).map((i) => `${i.table} ${i.message} ${i.fatal ? "fatal" : "note"}`);
  assert.deepEqual(issues(), []);
  // The reminder screens fall back to defaults; names, sizes and dates are never judged.
  db.runSync("UPDATE preferences SET reminder_schedule = 'not json', goal_ml = -5 WHERE id = 1");
  db.runSync("UPDATE drinks SET volume_ml = 90000, name = '=1+1', consumed_at = 4102444800000");
  assert.deepEqual(issues(), []);
  db.runSync("UPDATE preferences SET favorites = '[null]' WHERE id = 1");
  db.runSync("UPDATE drinks SET id = 'not a uuid!' WHERE rowid = (SELECT min(rowid) FROM drinks)");
  assert.deepEqual(issues(), ["preferences json:favorites fatal", "drinks value:id fatal"]);
  db.runSync("DELETE FROM preferences");
  assert.deepEqual(issues(), ["preferences count:singleton fatal", "drinks value:id fatal"]);
});

/**
 * A stand-in for expo-sqlite's change listener on connections opened with `enableChangeListener`: like SQLite's
 * update hook, one event per row a statement writes, at the moment it is written (a later ROLLBACK takes none back).
 */
function listenForChanges(w) {
  const events = [];
  const sqlite = w.require("expo-sqlite");
  const openAsync = sqlite.openDatabaseAsync;
  const written =
    /^\s*(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE(?:\s+OR\s+\w+)?|DELETE\s+FROM)\s+["`]?(\w+)/i;
  sqlite.openDatabaseAsync = async (name, options, directory) => {
    const db = await openAsync(name, options, directory);
    if (!options?.enableChangeListener) return db;
    const total = () => db.getFirstSync("SELECT total_changes() AS c").c;
    return new Proxy(db, {
      get(target, key) {
        if (key === "runSync")
          return (source, ...params) => {
            const result = target.runSync(source, ...params);
            const table = written.exec(source)?.[1];
            if (table) for (let i = 0; i < result.changes; i++) events.push(table);
            return result;
          };
        if (key === "execSync")
          return (source) => {
            const before = total();
            target.execSync(source);
            assert.equal(total(), before, `no rows written outside runSync: ${source}`);
          };
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  };
  return events;
}

test(
  "announceChange wakes the live queries once per table and changes nothing, also with no drinks at all",
  { skip },
  async (t) => {
    const { app, db, w } = await seeded(t);
    const events = listenForChanges(w);
    const before = snapshot({ w }, db);
    await app.database.announceChange();
    assert.deepEqual(events.sort(), ["drinks", "preferences"]);
    assert.equal(snapshot({ w }, db), before);

    db.runSync("DELETE FROM drinks");
    const empty = snapshot({ w }, db);
    events.length = 0;
    await app.database.announceChange();
    assert.deepEqual(events.sort(), ["drinks", "preferences"]);
    assert.equal(snapshot({ w }, db), empty, "the nudge row is rolled back");
    assert.equal(db.getFirstSync("SELECT count(*) AS n FROM drinks").n, 0);
  }
);

/** The names a function's body calls and the JSX tags it renders, with the `key` each keyed tag gets. */
function rendering(ts, fn) {
  const calls = new Set();
  const tags = new Map();
  const assigned = new Map();
  (function walk(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression))
      calls.add(node.expression.text);
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression)
    )
      assigned.set(node.name.text, node.initializer.expression.text);
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const key = node.attributes.properties.find(
        (a) => ts.isJsxAttribute(a) && a.name.getText() === "key"
      )?.initializer?.expression;
      tags.set(node.tagName.getText(), key && ts.isIdentifier(key) ? key.text : null);
    }
    ts.forEachChild(node, walk);
  })(fn.body);
  return { calls, tags, assigned };
}

test(
  "a restore re-keys the Settings form and the reminder editor, whose drafts come from stored values",
  { skip },
  async (t) => {
    const { w } = await open(t);
    // React's useSyncExternalStore as a render uses it: subscribe, then read the snapshot.
    const subscribers = [];
    const ui = w.load("src/vault-app-ui.ts", {
      react: {
        useSyncExternalStore: (subscribe, read) => {
          subscribers.push(subscribe);
          return read();
        },
      },
    });
    const key = ui.useVaultRestoreKey();
    let told = 0;
    const unsubscribe = subscribers[0](() => told++);
    const refresh = ui.useVaultRefresh();
    assert.equal(ui.useVaultRefresh(), refresh, "the same callback on every render");
    refresh();
    assert.equal(told, 1, "a mounted form hears of the restore");
    assert.equal(ui.useVaultRestoreKey(), key + 1, "and gets a new key");
    unsubscribe();
    refresh();
    assert.equal(told, 1, "an unmounted form is not told");
    assert.equal(ui.useVaultRestoreKey(), key + 2);

    // Settings renders the component that holds the drafts (and ReminderSettings, which seeds its own) with that key.
    const ts = w.require("typescript");
    const file = new URL("../src/app/(tabs)/settings.tsx", import.meta.url);
    const source = ts.createSourceFile(
      file.pathname,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    const functions = source.statements.filter(ts.isFunctionDeclaration);
    const screen = rendering(
      ts,
      functions.find((f) => f.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword))
    );
    const [form] =
      [...screen.tags].find(([, k]) => k && screen.assigned.get(k) === "useVaultRestoreKey") ?? [];
    assert.ok(form, "Settings keys a form with useVaultRestoreKey()");
    assert.equal(screen.calls.has("useState"), false, "no draft lives outside the keyed form");
    const drafts = rendering(
      ts,
      functions.find((f) => f.name?.text === form)
    );
    assert.ok(drafts.calls.has("useState"), `${form} holds the drafts`);
    assert.ok(drafts.tags.has("ReminderSettings"), `${form} renders ReminderSettings`);
  }
);

test(
  "pauseWhenIdle waits for a running Health sync, which stops at its next step, and holds new syncs off",
  { skip },
  async (t) => {
    const health = healthMock();
    const { app, db, w } = await seeded(t, { health });
    const sync = w.require("@/lib/health");
    const pending = db.getFirstSync(
      "SELECT count(*) AS n FROM drinks WHERE revision <> synced_revision"
    ).n;
    assert.ok(pending > 0);

    health.gate = deferred();
    health.reading = deferred();
    const running = sync.syncHealth();
    await health.reading.promise;
    let ran = false;
    const paused = app.hooks.pauseWhenIdle(async () => {
      ran = true;
      assert.equal(sync.healthSyncing(), false, "no sync runs during the work");
      await sync.syncHealth();
      assert.equal(sync.healthSyncing(), false, "a sync asked for meanwhile does not start");
      return "restored";
    }, 5_000);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(ran, false, "waits for the running sync");
    health.gate.resolve();
    assert.equal(await paused, "restored");
    await running;
    assert.deepEqual(health.writes, [], "the running sync stopped before exporting");

    health.gate = null;
    await sync.syncHealth();
    assert.equal(health.writes.length, pending, "after the pause, sync exports again");
  }
);

test("pauseWhenIdle gives up after its timeout without running the work", { skip }, async (t) => {
  const health = healthMock();
  const { app, w } = await seeded(t, { health });
  const sync = w.require("@/lib/health");
  health.gate = deferred();
  health.reading = deferred();
  const running = sync.syncHealth();
  await health.reading.promise;
  let ran = false;
  await assert.rejects(
    app.hooks.pauseWhenIdle(async () => {
      ran = true;
    }, 20),
    /healthBusy/
  );
  assert.equal(ran, false);
  // The hold ends with the failure: the running sync carries on.
  health.gate.resolve();
  await running;
  assert.ok(health.writes.length > 0);
});

test(
  "a backup's summary, preview phrases in every language and the drinks CSV",
  { skip },
  async (t) => {
    const { app, w } = await open(t);
    const db = await w.live();
    const empty = () => !!db.getFirstSync(app.emptySql).v;
    assert.equal(empty(), true, "a fresh install: only the rows the app writes itself");
    drink(db, { id: "tombstone", kind: "water", volume_ml: 250, consumed_at: 1, deleted: 1 });
    assert.equal(empty(), true, "a deleted drink is no record");
    w.seed(db);
    assert.equal(empty(), false);
    drink(db, {
      id: "formula",
      kind: "other",
      name: "=1+1",
      volume_ml: 473.176473,
      consumed_at: Date.parse("2026-09-29T03:30:00.000Z"),
    });

    const values = Object.fromEntries(
      Object.entries(app.summary).map(([key, sql]) => [key, db.getFirstSync(sql).v])
    );
    assert.equal(values.drinks, 8);
    assert.equal(values.first, Date.parse("2026-09-27T07:05:00.000Z"));
    assert.equal(values.latest, "2026-09-29T03:30:00.000Z");
    const context = (language) => ({
      language,
      plural: (n) => new Intl.PluralRules(language).select(n),
      number: (n) => new Intl.NumberFormat(language).format(n),
      date: (v) => new Date(v).toISOString().slice(0, 10),
    });
    assert.deepEqual(app.describe(values, context("en")), ["8 drinks", "Since 2026-09-27"]);
    assert.deepEqual(app.describe({ ...values, drinks: 1 }, context("en")), [
      "1 drink",
      "Since 2026-09-27",
    ]);
    assert.deepEqual(app.describe({ drinks: 0, first: null }, context("en")), []);
    for (const language of languages) {
      const phrases = app.describe(values, context(language));
      assert.equal(phrases.length, 2, language);
      assert.ok(phrases[0].includes("8") && phrases[1].includes("2026-09-27"), language);
      assert.ok(
        phrases.every((p) => !/[{}]/.test(p)),
        language
      );
    }

    const [csv, ...more] = await app.csv(db, { language: "en" });
    assert.deepEqual(more, []);
    assert.equal(csv.name, "drinks.csv");
    const lines = csv.text.split("\r\n");
    assert.equal(lines.at(-1), "", "every record ends with CRLF");
    assert.equal(
      lines[0],
      '"consumed_at_utc","local_date","local_time","kind","name","volume_ml","volume_fl_oz","caffeine_mg","abv"'
    );
    assert.equal(lines.length, 1 + 8 + 1, "deleted drinks are left out");
    const at = new Date("2026-09-29T03:30:00.000Z");
    const pad = (n) => String(n).padStart(2, "0");
    assert.equal(
      lines.at(-2),
      [
        at.toISOString(),
        `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
        `${pad(at.getHours())}:${pad(at.getMinutes())}`,
        "other",
        "'=1+1",
        "473.176473",
        "16.0",
        "0",
        "0",
      ]
        .map((cell) => `"${cell}"`)
        .join(",")
    );
  }
);
