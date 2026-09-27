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
    Number,
    require: (id) => (Object.hasOwn(mocks, id) ? mocks[id] : require(id)),
  });
  return exports;
}
const metrics = load("metrics");
const favorites = load("favorites");
const quickLog = load("quick-log", { "./metrics": metrics, "./favorites": favorites });
// Values created inside the VM have their own prototypes; compare plain copies.
const plain = (value) => JSON.parse(JSON.stringify(value));

const now = new Date(2026, 8, 27, 15, 0).getTime();
const drink = {
  id: "0f8fad5b-d9cb-469f-a165-70867728950e",
  kind: "coffee",
  name: "Latte",
  volumeMl: 240,
  caffeineMg: 63,
  abv: 0,
  consumedAt: now - 60000,
};

test("reminder quick logs are a plain glass of water at the reminder size", () => {
  assert.deepEqual(plain(quickLog.reminderIntake(250)), {
    kind: "water",
    volumeMl: 250,
    caffeineMg: 0,
    abv: 0,
  });
  assert.throws(() => quickLog.reminderIntake(0));
});

test("queued drinks from the watch and notifications are validated", () => {
  assert.deepEqual(plain(quickLog.queuedDrink(drink, now)), drink);
  // WatchConnectivity payloads omit a missing name, and an empty one is stored as null.
  const { name: _name, ...unnamed } = drink;
  assert.equal(quickLog.queuedDrink(unnamed, now).name, null);
  assert.equal(quickLog.queuedDrink({ ...drink, name: "" }, now).name, null);
  // A watch clock slightly ahead never logs a drink in the future.
  assert.equal(quickLog.queuedDrink({ ...drink, consumedAt: now + 5000 }, now).consumedAt, now);
  for (const invalid of [
    null,
    "drink",
    { ...drink, id: 7 },
    { ...drink, id: "has spaces" },
    { ...drink, kind: "soda" },
    { ...drink, kind: "toString" },
    { ...drink, name: 3 },
    { ...drink, volumeMl: 0 },
    { ...drink, volumeMl: 5001 },
    { ...drink, volumeMl: "240" },
    { ...drink, caffeineMg: -1 },
    { ...drink, caffeineMg: 2001 },
    { ...drink, abv: 101 },
    { ...drink, consumedAt: NaN },
    { ...drink, consumedAt: undefined },
  ])
    assert.equal(quickLog.queuedDrink(invalid, now), null, JSON.stringify(invalid));
});

const settings = {
  goalMl: 2500,
  defaultMl: 250,
  quickMl: 500,
  units: "metric",
  favorites: JSON.stringify([
    { id: "water", kind: "water", name: "", ml: 250, caffeine: 0, abv: 0 },
    { id: "monster", kind: "energy", name: "Monster", ml: 500, caffeine: 160, abv: 0 },
    { id: "hidden", kind: "tea", name: "Hidden", ml: 240, caffeine: 40, abv: 0, showOnHome: false },
    { id: "beer", kind: "alcohol", name: "Beer", ml: 355, caffeine: 0, abv: 5, color: "plum" },
    // 10 mL with 200 mg of caffeine scales past the 2,000 mg limit at 500 mL.
    { id: "shot", kind: "preworkout", name: "Shot", ml: 10, caffeine: 200, abv: 0 },
  ]),
};
const row = (id, consumedAt, volumeMl, extra = {}) => ({
  id,
  kind: "water",
  volumeMl,
  caffeineMg: 0,
  abv: 0,
  consumedAt,
  deleted: false,
  ...extra,
});
const t = (key) => `t:${key}`;

test("the watch gets today's goal progress, drink IDs, and loggable home favorites", () => {
  const rows = [
    row("a", now - 3600000, 300),
    row("beer", now - 1800000, 355, { abv: 5 }),
    row("deleted", now - 900000, 1000, { deleted: true }),
    row("yesterday", now - 24 * 3600000, 700),
  ];
  const state = plain(quickLog.watchState({ rows, settings, now, locale: "en", t }));
  assert.equal(state.day, metrics.startOfDay(now));
  assert.equal(state.totalMl, 300);
  assert.equal(state.goalMl, 2500);
  assert.equal(state.sizeMl, 500);
  assert.deepEqual(state.ids, ["a", "beer", "deleted"]);
  assert.deepEqual(
    state.favorites.map((f) => [f.id, f.title, f.color, f.volumeMl, f.caffeineMg, f.abv]),
    [
      ["water", "t:water", "cyan", 500, 0, 0],
      ["monster", "Monster", "amber", 500, 160, 0],
      ["beer", "Beer", "plum", 500, 0, 5],
    ]
  );
  assert.equal(state.favorites[0].name, null);
  assert.deepEqual(state.text, {
    logged: "t:logged",
    undo: "t:undo",
    empty: "t:favoriteEmpty",
    addDrink: "t:addDrink",
  });
});

test("the watch uses the default size when no home size is saved and caps its favorites", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    id: `w${i}`,
    kind: "water",
    name: `Water ${i}`,
    ml: 250,
    caffeine: 0,
    abv: 0,
  }));
  const state = quickLog.watchState({
    rows: [],
    settings: { ...settings, quickMl: null, favorites: JSON.stringify(many) },
    now,
    locale: "en",
    t,
  });
  assert.equal(state.sizeMl, 250);
  assert.equal(state.totalMl, 0);
  assert.equal(state.favorites.length, quickLog.WATCH_FAVORITE_LIMIT);
});
