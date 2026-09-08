import type { DrinkKind } from "./metrics";

export type Favorite = {
  id: string;
  kind: DrinkKind;
  name: string;
  ml: number;
  caffeine: number;
  abv: number;
};

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
