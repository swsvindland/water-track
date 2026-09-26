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
} from "../src/lib/favorites.ts";

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
  assert.equal(favoriteIntake(homeFavorites(enabled)[0], 120).caffeineMg, 14);
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
    { id: "drip-coffee", kind: "coffee", name: "Drip coffee", ml: 240, caffeine: 95, abv: 0 }
  );
});

test("seeded favorites match presets and legacy seeds stay on home as custom drinks", () => {
  const seed = [
    { id: "water", kind: "water", name: "", ml: 250, caffeine: 0, abv: 0 },
    { id: "drip-coffee", kind: "coffee", name: "Drip coffee", ml: 240, caffeine: 95, abv: 0 },
  ];
  for (const favorite of seed) {
    assert.deepEqual(
      popularDrinks.find((drink) => drink.id === favorite.id),
      favorite
    );
  }
  const legacy = [
    { id: "water", kind: "water", name: "", ml: 250, caffeine: 0, abv: 0 },
    { id: "energy", kind: "energy", name: "", ml: 473, caffeine: 160, abv: 0 },
    { id: "coffee", kind: "coffee", name: "", ml: 240, caffeine: 95, abv: 0 },
    { id: "tea", kind: "tea", name: "", ml: 240, caffeine: 40, abv: 0 },
  ];
  const catalog = drinkCatalog(legacy);
  assert.deepEqual(homeFavorites(catalog), legacy);
  assert.deepEqual(
    catalog.filter((drink) => !isPopularDrink(drink)).map((drink) => drink.id),
    ["energy", "coffee", "tea"]
  );
  assert.equal(catalog.find((drink) => drink.id === "drip-coffee").showOnHome, false);
});
