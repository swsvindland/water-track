import type { DrinkKind } from "./metrics";

export type Favorite = {
  id: string;
  kind: DrinkKind;
  name: string;
  ml: number;
  caffeine: number;
  abv: number;
  color?: FavoriteColor;
  showOnHome?: boolean;
};

// US fluid ounces in mL (OZ_ML), inlined so this module has no runtime imports.
// Cup and shot caffeine values are quoted per US serving, so their sizes are exact.
const floz = (n: number) => n * 29.5735295625;

// Stable IDs match the original seeded favorites. Missing presets stay hidden so
// upgrading never restores a drink that someone previously removed.
export const popularDrinks: Favorite[] = [
  { id: "water", kind: "water", name: "", ml: 250, caffeine: 0, abv: 0 },
  { id: "coffee", kind: "coffee", name: "", ml: floz(8), caffeine: 95, abv: 0 },
  { id: "tea", kind: "tea", name: "", ml: floz(8), caffeine: 47, abv: 0 },
  { id: "energy", kind: "energy", name: "", ml: 473, caffeine: 160, abv: 0 },
  { id: "preworkout", kind: "preworkout", name: "", ml: 300, caffeine: 200, abv: 0 },
  { id: "alcohol", kind: "alcohol", name: "", ml: 355, caffeine: 0, abv: 5 },
  { id: "sparkling-water", kind: "water", name: "Sparkling water", ml: 355, caffeine: 0, abv: 0 },
  { id: "seltzer", kind: "water", name: "Seltzer", ml: 355, caffeine: 0, abv: 0 },
  { id: "mineral-water", kind: "water", name: "Mineral water", ml: 500, caffeine: 0, abv: 0 },
  { id: "orange-juice", kind: "juice", name: "Orange juice", ml: 240, caffeine: 0, abv: 0 },
  { id: "apple-juice", kind: "juice", name: "Apple juice", ml: 240, caffeine: 0, abv: 0 },
  { id: "grape-juice", kind: "juice", name: "Grape juice", ml: 240, caffeine: 0, abv: 0 },
  { id: "cranberry-juice", kind: "juice", name: "Cranberry juice", ml: 240, caffeine: 0, abv: 0 },
  { id: "pineapple-juice", kind: "juice", name: "Pineapple juice", ml: 240, caffeine: 0, abv: 0 },
  { id: "grapefruit-juice", kind: "juice", name: "Grapefruit juice", ml: 240, caffeine: 0, abv: 0 },
  {
    id: "monster-original",
    kind: "energy",
    name: "Monster Original",
    ml: 473,
    caffeine: 160,
    abv: 0,
  },
  {
    id: "monster-zero-ultra",
    kind: "energy",
    name: "White Monster (Zero Ultra)",
    ml: 473,
    caffeine: 150,
    abv: 0,
  },
  {
    id: "celsius-original",
    kind: "energy",
    name: "Celsius Original",
    ml: 355,
    caffeine: 200,
    abv: 0,
  },
  {
    id: "alani-nu-energy",
    kind: "energy",
    name: "Alani Nu Energy",
    ml: 355,
    caffeine: 200,
    abv: 0,
  },
  {
    id: "red-bull-original",
    kind: "energy",
    name: "Red Bull Original",
    ml: 250,
    caffeine: 80,
    abv: 0,
  },
  { id: "espresso", kind: "coffee", name: "Espresso", ml: floz(1), caffeine: 63, abv: 0 },
  { id: "americano", kind: "coffee", name: "Americano", ml: floz(8), caffeine: 126, abv: 0 },
  { id: "latte", kind: "coffee", name: "Latte", ml: floz(8), caffeine: 63, abv: 0 },
  { id: "cappuccino", kind: "coffee", name: "Cappuccino", ml: floz(6), caffeine: 63, abv: 0 },
  { id: "cold-brew", kind: "coffee", name: "Cold brew", ml: floz(8), caffeine: 150, abv: 0 },
  { id: "decaf-coffee", kind: "coffee", name: "Decaf coffee", ml: floz(8), caffeine: 2, abv: 0 },
  { id: "jasmine-tea", kind: "tea", name: "Jasmine tea", ml: floz(8), caffeine: 30, abv: 0 },
  { id: "black-tea", kind: "tea", name: "Black tea", ml: floz(8), caffeine: 47, abv: 0 },
  { id: "green-tea", kind: "tea", name: "Green tea", ml: floz(8), caffeine: 28, abv: 0 },
  { id: "oolong-tea", kind: "tea", name: "Oolong tea", ml: floz(8), caffeine: 38, abv: 0 },
  { id: "matcha", kind: "tea", name: "Matcha", ml: floz(8), caffeine: 70, abv: 0 },
  { id: "herbal-tea", kind: "tea", name: "Herbal tea", ml: 240, caffeine: 0, abv: 0 },
  { id: "cows-milk", kind: "milk", name: "Cow’s milk", ml: 240, caffeine: 0, abv: 0 },
  { id: "soy-milk", kind: "milk", name: "Soy milk", ml: 240, caffeine: 0, abv: 0 },
  { id: "almond-milk", kind: "milk", name: "Almond milk", ml: 240, caffeine: 0, abv: 0 },
  { id: "oat-milk", kind: "milk", name: "Oat milk", ml: 240, caffeine: 0, abv: 0 },
  { id: "coconut-milk", kind: "milk", name: "Coconut milk beverage", ml: 240, caffeine: 0, abv: 0 },
  { id: "beer", kind: "alcohol", name: "Beer", ml: 355, caffeine: 0, abv: 5 },
  { id: "wine", kind: "alcohol", name: "Wine", ml: 148, caffeine: 0, abv: 12 },
  { id: "whiskey", kind: "alcohol", name: "Whiskey", ml: 44, caffeine: 0, abv: 40 },
  { id: "vodka", kind: "alcohol", name: "Vodka", ml: 44, caffeine: 0, abv: 40 },
  { id: "gin", kind: "alcohol", name: "Gin", ml: 44, caffeine: 0, abv: 40 },
  { id: "rum", kind: "alcohol", name: "Rum", ml: 44, caffeine: 0, abv: 40 },
  { id: "tequila", kind: "alcohol", name: "Tequila", ml: 44, caffeine: 0, abv: 40 },
  { id: "hard-seltzer", kind: "alcohol", name: "Hard seltzer", ml: 355, caffeine: 0, abv: 5 },
];

// Recipes earlier releases shipped (and saved alongside visibility changes) for presets
// that have since been corrected, as [ml, caffeine, abv]. A saved copy that still matches
// was never customized, so it follows the current preset.
const previousRecipes: Record<string, [number, number, number]> = {
  coffee: [240, 95, 0],
  tea: [240, 40, 0],
  espresso: [30, 63, 0],
  americano: [240, 126, 0],
  latte: [240, 63, 0],
  cappuccino: [180, 63, 0],
  "cold-brew": [240, 150, 0],
  "decaf-coffee": [240, 2, 0],
  "jasmine-tea": [240, 30, 0],
  "black-tea": [240, 47, 0],
  "green-tea": [240, 28, 0],
  "oolong-tea": [240, 38, 0],
  matcha: [240, 70, 0],
};

export function savedFavorites(json: string): Favorite[] {
  return (JSON.parse(json) as Favorite[]).map((saved) => {
    const preset = popularDrinks.find((drink) => drink.id === saved.id);
    const previous = previousRecipes[saved.id];
    return preset &&
      previous &&
      saved.kind === preset.kind &&
      saved.ml === previous[0] &&
      saved.caffeine === previous[1] &&
      saved.abv === previous[2]
      ? { ...saved, ml: preset.ml, caffeine: preset.caffeine, abv: preset.abv }
      : saved;
  });
}

export function isPopularDrink(favorite: Favorite) {
  return popularDrinks.some((drink) => drink.id === favorite.id);
}

export function drinkCatalog(saved: Favorite[]): Favorite[] {
  return [
    ...saved,
    ...popularDrinks
      .filter((drink) => !saved.some((favorite) => favorite.id === drink.id))
      .map((drink) => ({ ...drink, showOnHome: false })),
  ];
}

export function homeFavorites(saved: Favorite[]): Favorite[] {
  return saved.filter((favorite) => favorite.showOnHome !== false);
}

export function favoriteIntake(favorite: Favorite, volumeMl: number) {
  // Scale by the size ratio so logging exactly the reference size returns its label value.
  const caffeineMg = favorite.caffeine * (volumeMl / favorite.ml);
  if (
    !Number.isFinite(volumeMl) ||
    volumeMl < 1 ||
    volumeMl > 5000 ||
    !Number.isFinite(caffeineMg) ||
    caffeineMg < 0 ||
    caffeineMg > 2000
  ) {
    throw new Error("Invalid quick drink");
  }
  return {
    kind: favorite.kind,
    name: favorite.name || null,
    volumeMl,
    caffeineMg,
    abv: favorite.abv,
  };
}

export const favoriteColors = [
  "cyan",
  "brown",
  "sage",
  "amber",
  "violet",
  "rose",
  "slate",
  "blue",
  "teal",
  "olive",
  "terracotta",
  "plum",
] as const;
export type FavoriteColor = (typeof favoriteColors)[number];

const defaultColors: Record<DrinkKind, FavoriteColor> = {
  water: "cyan",
  juice: "terracotta",
  milk: "slate",
  coffee: "brown",
  tea: "sage",
  energy: "amber",
  preworkout: "violet",
  alcohol: "rose",
  other: "slate",
};

export function favoriteColor(favorite: Pick<Favorite, "kind" | "color">): FavoriteColor {
  return favoriteColors.includes(favorite.color as FavoriteColor)
    ? favorite.color!
    : (defaultColors[favorite.kind] ?? "slate");
}

// Static classes keep all palette tokens discoverable by Tailwind/Uniwind.
export const favoriteColorClasses: Record<
  FavoriteColor,
  { background: string; foreground: string }
> = {
  cyan: { background: "bg-favorite-cyan", foreground: "text-favorite-cyan-foreground" },
  brown: { background: "bg-favorite-brown", foreground: "text-favorite-brown-foreground" },
  sage: { background: "bg-favorite-sage", foreground: "text-favorite-sage-foreground" },
  amber: { background: "bg-favorite-amber", foreground: "text-favorite-amber-foreground" },
  violet: { background: "bg-favorite-violet", foreground: "text-favorite-violet-foreground" },
  rose: { background: "bg-favorite-rose", foreground: "text-favorite-rose-foreground" },
  blue: { background: "bg-favorite-blue", foreground: "text-favorite-blue-foreground" },
  teal: { background: "bg-favorite-teal", foreground: "text-favorite-teal-foreground" },
  olive: { background: "bg-favorite-olive", foreground: "text-favorite-olive-foreground" },
  terracotta: {
    background: "bg-favorite-terracotta",
    foreground: "text-favorite-terracotta-foreground",
  },
  plum: { background: "bg-favorite-plum", foreground: "text-favorite-plum-foreground" },
  slate: { background: "bg-favorite-slate", foreground: "text-favorite-slate-foreground" },
};
