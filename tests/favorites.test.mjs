import test from "node:test";
import assert from "node:assert/strict";
import { favoriteIntake, favoriteColor, favoriteColors } from "../src/lib/favorites.ts";

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
