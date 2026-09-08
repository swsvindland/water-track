import test from "node:test";
import assert from "node:assert/strict";
import {
  favoriteIntake,
  favoriteColor,
  favoriteColors,
  drinkCatalog,
  homeFavorites,
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
  const enabled = reopened.map((drink) => ({ ...drink, showOnHome: drink.id === "tea" }));
  assert.deepEqual(
    homeFavorites(enabled).map((drink) => drink.id),
    ["tea"]
  );
  assert.equal(favoriteIntake(homeFavorites(enabled)[0], 120).caffeineMg, 20);
});

test("expanded presets have unique IDs and valid recipes for every drink group", () => {
  assert.equal(new Set(popularDrinks.map((drink) => drink.id)).size, popularDrinks.length);
  for (const kind of [
    "water",
    "juice",
    "energy",
    "coffee",
    "tea",
    "milk",
    "alcohol",
    "preworkout",
  ]) {
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
