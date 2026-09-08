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
