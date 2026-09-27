import type { Drink, Preferences } from "@/db/schema";
import type { Message } from "./i18n";
import { favoriteColor, favoriteIntake, homeFavorites, savedFavorites } from "./favorites";
import { inDay, kinds, startOfDay, totals, type DrinkKind } from "./metrics";

// Notification action that logs a glass of water without opening the app. Apple Watch and
// Wear OS show it on mirrored reminders too.
export const QUICK_LOG_ACTION = "log-drink";
export const REMINDER_CATEGORY = "hydration-reminder";

export type QuickIntake = ReturnType<typeof favoriteIntake>;
export type QueuedDrink = QuickIntake & { id: string; consumedAt: number };

// The same glass the reminder plan counts, as a plain water entry. It has no name, so it can be
// stored in iOS notification userInfo, which can't hold null.
export function reminderIntake(glassMl: number) {
  const { kind, volumeMl, caffeineMg, abv } = favoriteIntake(
    { id: "water", kind: "water", name: "", ml: glassMl, caffeine: 0, abv: 0 },
    glassMl
  );
  return { kind, volumeMl, caffeineMg, abv };
}
export type ReminderIntake = ReturnType<typeof reminderIntake>;

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

// Drinks logged on Apple Watch or from a reminder arrive from outside the app, so each one is
// checked before it reaches the database. A timestamp ahead of this device's clock is clamped.
export function queuedDrink(value: unknown, now: number): QueuedDrink | null {
  if (!value || typeof value !== "object") return null;
  const drink = value as Record<string, unknown>;
  const name = drink.name ?? null;
  if (
    typeof drink.id !== "string" ||
    !/^[\w-]{1,64}$/.test(drink.id) ||
    !kinds.includes(drink.kind as DrinkKind) ||
    !(name === null || (typeof name === "string" && name.length <= 200)) ||
    !inRange(drink.volumeMl, 1, 5000) ||
    !inRange(drink.caffeineMg, 0, 2000) ||
    !inRange(drink.abv, 0, 100) ||
    !inRange(drink.consumedAt, 1, Number.MAX_SAFE_INTEGER)
  )
    return null;
  return {
    id: drink.id,
    kind: drink.kind as DrinkKind,
    name: name || null,
    volumeMl: drink.volumeMl,
    caffeineMg: drink.caffeineMg,
    abv: drink.abv,
    consumedAt: Math.min(drink.consumedAt, now),
  };
}

// Pages of four on the watch; more than this is more swiping than a watch should need.
export const WATCH_FAVORITE_LIMIT = 24;

// Everything the watch app shows, sent whenever it changes. Totals are today's so far; the watch
// adds its own drinks that the iPhone hasn't recorded yet, recognizing recorded ones by `ids`.
export function watchState({
  rows,
  settings,
  now,
  locale,
  t,
}: {
  rows: Drink[];
  settings: Preferences;
  now: number;
  locale: string;
  t: (key: Message) => string;
}) {
  const today = rows.filter((drink) => inDay(drink.consumedAt, now));
  const sizeMl = settings.quickMl ?? settings.defaultMl;
  const favorites = [];
  for (const favorite of homeFavorites(savedFavorites(settings.favorites))) {
    if (favorites.length === WATCH_FAVORITE_LIMIT) break;
    try {
      favorites.push({
        ...favoriteIntake(favorite, sizeMl),
        id: favorite.id,
        title: favorite.name || t(favorite.kind),
        color: favoriteColor(favorite),
      });
    } catch {
      // A favorite whose scaled caffeine is out of range can't be logged at this size.
    }
  }
  return {
    day: startOfDay(now),
    totalMl: totals(today.filter((drink) => !drink.deleted)).goalFluid,
    goalMl: settings.goalMl,
    sizeMl,
    units: settings.units,
    locale,
    // Deleted drinks are included so the watch stops counting a drink the iPhone already removed.
    ids: today.map((drink) => drink.id),
    favorites,
    text: {
      logged: t("logged"),
      undo: t("undo"),
      empty: t("favoriteEmpty"),
      addDrink: t("addDrink"),
    },
  };
}
export type WatchState = ReturnType<typeof watchState>;
