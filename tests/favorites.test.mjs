import test from "node:test";
import assert from "node:assert/strict";
import {
  favoriteIntake,
  favoriteColor,
  favoriteColors,
  drinkCatalog,
  favoriteSections,
  homeFavorites,
  isPopularDrink,
  popularDrinks,
  savedFavorites,
} from "../src/lib/favorites.ts";
import { alcoholGrams, OZ_ML, totals } from "../src/lib/metrics.ts";

const energy = { id: "monster", kind: "energy", name: "Monster", ml: 500, caffeine: 160, abv: 0 };
test("quick logging scales caffeine to the selected serving and retains custom names", () => {
  assert.deepEqual(favoriteIntake(energy, 250), {
    kind: "energy",
    name: "Monster",
    volumeMl: 250,
    caffeineMg: 80,
    abv: 0,
  });
  assert.equal(favoriteIntake({ ...energy, kind: "alcohol", abv: 5 }, 250).abv, 5);
});
test("quick logging rejects invalid sizes and excessive scaled caffeine", () => {
  for (const size of [NaN, 0, -1, 5001, Infinity]) {
    assert.throws(() => favoriteIntake(energy, size));
  }
  assert.throws(() => favoriteIntake({ ...energy, ml: 10 }, 500));
  assert.equal(favoriteIntake({ ...energy, name: "", caffeine: 0 }, 5000).name, null);
});

test("favorites without a saved color use drink defaults, including legacy records", () => {
  const expected = {
    water: "cyan",
    coffee: "brown",
    tea: "sage",
    energy: "amber",
    preworkout: "violet",
    alcohol: "rose",
    other: "slate",
  };
  for (const [kind, color] of Object.entries(expected)) {
    assert.equal(favoriteColor({ kind }), color);
    assert.equal(favoriteColor({ kind, color: "unsupported" }), color);
  }
});

test("saved palette choices survive serialization and override drink defaults", () => {
  for (const color of favoriteColors) {
    const saved = JSON.parse(JSON.stringify({ ...energy, color }));
    assert.equal(favoriteColor(saved), color);
    assert.deepEqual(favoriteIntake(saved, 250), favoriteIntake(energy, 250));
  }
});

test("catalog preserves legacy selections and recipes without restoring removed defaults", () => {
  const customWater = { ...popularDrinks[0], ml: 600, color: "blue" };
  const saved = [energy, customWater];
  const catalog = drinkCatalog(saved);
  assert.deepEqual(homeFavorites(catalog), saved);
  assert.deepEqual(
    catalog.find((drink) => drink.id === "water"),
    customWater
  );
  assert.equal(new Set(catalog.map((drink) => drink.id)).size, catalog.length);
  assert.deepEqual(homeFavorites(drinkCatalog([])), []);
});

test("visibility persists independently of recipes and can be enabled again", () => {
  const catalog = drinkCatalog([energy]);
  const hidden = catalog.map((drink) => ({ ...drink, showOnHome: false }));
  const reopened = drinkCatalog(JSON.parse(JSON.stringify(hidden)));
  assert.deepEqual(homeFavorites(reopened), []);
  assert.deepEqual(
    reopened.find((drink) => drink.id === energy.id),
    { ...energy, showOnHome: false }
  );
  const enabled = reopened.map((drink) => ({ ...drink, showOnHome: drink.id === "green-tea" }));
  assert.deepEqual(
    homeFavorites(enabled).map((drink) => drink.id),
    ["green-tea"]
  );
  assert.equal(favoriteIntake(homeFavorites(enabled)[0], 4 * OZ_ML).caffeineMg, 14);
});

test("expanded presets have unique IDs and valid recipes for every drink group", () => {
  assert.equal(new Set(popularDrinks.map((drink) => drink.id)).size, popularDrinks.length);
  for (const kind of favoriteSections) {
    assert.ok(
      popularDrinks.some((drink) => drink.kind === kind),
      kind
    );
  }
  for (const drink of popularDrinks) {
    const intake = favoriteIntake(drink, drink.ml);
    assert.equal(intake.caffeineMg, drink.caffeine);
    assert.ok(drink.abv >= 0 && drink.abv <= 100);
    if (drink.kind !== "alcohol") assert.equal(drink.abv, 0);
  }
});

test("branded caffeine and spirit strength survive serving changes", () => {
  const redBull = popularDrinks.find((drink) => drink.id === "red-bull-original");
  assert.equal(favoriteIntake(redBull, 500).caffeineMg, 160);
  const whiskey = popularDrinks.find((drink) => drink.id === "whiskey");
  assert.equal(favoriteIntake(whiskey, 88).abv, 40);
});

const preset = (id) => popularDrinks.find((drink) => drink.id === id);
const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} ≠ ${expected}`);

test("a day of 8 waters, 2 White Monsters and 3 espresso shots adds up to label values", () => {
  const log = (id, oz, count) =>
    Array.from({ length: count }, () => favoriteIntake(preset(id), oz * OZ_ML));
  const day = totals(
    [...log("water", 8, 8), ...log("monster-zero-ultra", 16, 2), ...log("espresso", 1, 3)].map(
      (intake) => ({ ...intake, consumedAt: 0 })
    )
  );
  near(day.fluid / OZ_ML, 8 * 8 + 2 * 16 + 3, 1e-9, "fluid oz");
  near(day.goalFluid, day.fluid, 1e-9, "goal fluid");
  near(day.caffeine, 2 * 150 + 3 * 63, 0.2, "caffeine mg");
  assert.equal(day.alcohol, 0);
});

test("branded and brewed caffeine presets match label values at label sizes", () => {
  for (const [id, oz, mg] of [
    ["monster-zero-ultra", 16, 150],
    ["monster-original", 16, 160],
    ["red-bull-original", 12, 114],
    ["red-bull-original", 16, 151],
    ["red-bull-original", 20, 189],
    ["celsius-original", 12, 200],
    ["alani-nu-energy", 12, 200],
    ["drip-coffee", 8, 95],
    ["espresso", 1, 63],
    ["americano", 8, 126],
    ["black-tea", 8, 47],
    ["green-tea", 8, 28],
  ]) {
    near(favoriteIntake(preset(id), oz * OZ_ML).caffeineMg, mg, 0.5, `${id} ${oz} fl oz`);
  }
  assert.equal(favoriteIntake(preset("red-bull-original"), 250).caffeineMg, 80);
});

test("alcohol presets are one US standard drink and ABV scales with the logged size", () => {
  for (const drink of popularDrinks.filter((drink) => drink.kind === "alcohol")) {
    const intake = favoriteIntake(drink, drink.ml);
    near(alcoholGrams(intake), 14, 0.15, drink.id);
  }
  // Two 12 fl oz beers or an 8 fl oz pour of whiskey, as set on the size slider.
  near(alcoholGrams(favoriteIntake(preset("beer"), 24 * OZ_ML)), 28, 0.05, "24 fl oz beer");
  near(alcoholGrams(favoriteIntake(preset("whiskey"), 8 * OZ_ML)), 74.67, 0.01, "8 fl oz whiskey");
});

test("saved presets follow corrected recipes unless someone customized them", () => {
  const saved = JSON.stringify([
    { id: "water", kind: "water", name: "", ml: 250, caffeine: 0, abv: 0 },
    {
      id: "drip-coffee",
      kind: "coffee",
      name: "Drip coffee",
      ml: 240,
      caffeine: 95,
      abv: 0,
      color: "plum",
    },
    {
      id: "espresso",
      kind: "coffee",
      name: "Espresso",
      ml: 30,
      caffeine: 63,
      abv: 0,
      showOnHome: false,
    },
    { id: "green-tea", kind: "tea", name: "Green tea", ml: 240, caffeine: 35, abv: 0 },
    { id: "mine", kind: "coffee", name: "Mine", ml: 240, caffeine: 95, abv: 0 },
  ]);
  const [water, drip, espresso, greenTea, mine] = savedFavorites(saved);
  assert.deepEqual(water, preset("water"));
  assert.deepEqual(drip, { ...preset("drip-coffee"), color: "plum" });
  assert.deepEqual(espresso, { ...preset("espresso"), showOnHome: false });
  assert.equal(greenTea.caffeine, 35);
  assert.equal(greenTea.ml, 240);
  assert.equal(mine.ml, 240);
  assert.equal(favoriteIntake(espresso, 3 * OZ_ML).caffeineMg, 189);
  assert.ok(drinkCatalog(savedFavorites(saved)).some((drink) => drink.id === "monster-zero-ultra"));
});

test("favorites menu sections follow the requested order and cover every preset", () => {
  assert.deepEqual(favoriteSections, [
    "water",
    "energy",
    "coffee",
    "tea",
    "juice",
    "milk",
    "alcohol",
  ]);
  for (const drink of popularDrinks) assert.ok(favoriteSections.includes(drink.kind), drink.id);
  const kindOrder = [...new Set(popularDrinks.map((drink) => drink.kind))];
  assert.deepEqual(kindOrder, favoriteSections);
});

test("generic presets are retired and drip coffee leads the coffee section", () => {
  for (const id of ["coffee", "tea", "energy", "preworkout", "alcohol"]) {
    assert.equal(
      popularDrinks.find((drink) => drink.id === id),
      undefined,
      id
    );
  }
  assert.ok(!popularDrinks.some((drink) => drink.kind === "preworkout"));
  assert.deepEqual(
    popularDrinks.find((drink) => drink.kind === "coffee"),
    { id: "drip-coffee", kind: "coffee", name: "Drip coffee", ml: 8 * OZ_ML, caffeine: 95, abv: 0 }
  );
});

test("seeded favorites match presets and legacy seeds stay on home as custom drinks", () => {
  const seed = [
    { id: "water", kind: "water", name: "", ml: 250, caffeine: 0, abv: 0 },
    { id: "drip-coffee", kind: "coffee", name: "Drip coffee", ml: 240, caffeine: 95, abv: 0 },
  ];
  // The database seed predates exact fl oz sizes; loading it resolves to the presets.
  assert.deepEqual(
    savedFavorites(JSON.stringify(seed)),
    seed.map((favorite) => popularDrinks.find((drink) => drink.id === favorite.id))
  );
  const legacy = [
    { id: "water", kind: "water", name: "", ml: 250, caffeine: 0, abv: 0 },
    { id: "energy", kind: "energy", name: "", ml: 473, caffeine: 160, abv: 0 },
    { id: "coffee", kind: "coffee", name: "", ml: 240, caffeine: 95, abv: 0 },
    { id: "tea", kind: "tea", name: "", ml: 240, caffeine: 40, abv: 0 },
  ];
  const catalog = drinkCatalog(savedFavorites(JSON.stringify(legacy)));
  assert.deepEqual(homeFavorites(catalog), legacy);
  assert.deepEqual(
    catalog.filter((drink) => !isPopularDrink(drink)).map((drink) => drink.id),
    ["energy", "coffee", "tea"]
  );
  assert.equal(catalog.find((drink) => drink.id === "drip-coffee").showOnHome, false);
});
