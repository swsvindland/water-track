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

// Stable IDs match the original seeded favorites. Missing presets stay hidden so
// upgrading never restores a drink that someone previously removed.
export const popularDrinks: Favorite[] = [
  { id: "water", kind: "water", name: "", ml: 250, caffeine: 0, abv: 0 },
  { id: "coffee", kind: "coffee", name: "", ml: 240, caffeine: 95, abv: 0 },
  { id: "tea", kind: "tea", name: "", ml: 240, caffeine: 40, abv: 0 },
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
  { id: "espresso", kind: "coffee", name: "Espresso", ml: 30, caffeine: 63, abv: 0 },
  { id: "americano", kind: "coffee", name: "Americano", ml: 240, caffeine: 126, abv: 0 },
  { id: "latte", kind: "coffee", name: "Latte", ml: 240, caffeine: 63, abv: 0 },
  { id: "cappuccino", kind: "coffee", name: "Cappuccino", ml: 180, caffeine: 63, abv: 0 },
  { id: "cold-brew", kind: "coffee", name: "Cold brew", ml: 240, caffeine: 150, abv: 0 },
  { id: "decaf-coffee", kind: "coffee", name: "Decaf coffee", ml: 240, caffeine: 2, abv: 0 },
  { id: "jasmine-tea", kind: "tea", name: "Jasmine tea", ml: 240, caffeine: 30, abv: 0 },
  { id: "black-tea", kind: "tea", name: "Black tea", ml: 240, caffeine: 47, abv: 0 },
  { id: "green-tea", kind: "tea", name: "Green tea", ml: 240, caffeine: 28, abv: 0 },
  { id: "oolong-tea", kind: "tea", name: "Oolong tea", ml: 240, caffeine: 38, abv: 0 },
  { id: "matcha", kind: "tea", name: "Matcha", ml: 240, caffeine: 70, abv: 0 },
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
  const caffeineMg = (favorite.caffeine * volumeMl) / favorite.ml;
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
