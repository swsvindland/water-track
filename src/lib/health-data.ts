import { alcoholGrams, estimateBac } from "./metrics";

type HealthDrink = {
  id: string;
  volumeMl: number;
  caffeineMg: number;
  abv: number;
  consumedAt: number;
  deleted: boolean;
};

export function validHealthWeight(kg: number, measuredAt: number, now = Date.now()) {
  return (
    Number.isFinite(kg) &&
    kg >= 20 &&
    kg <= 400 &&
    Number.isFinite(measuredAt) &&
    measuredAt > 0 &&
    measuredAt <= now
  );
}

export function bacWeight(settings: {
  healthEnabled: boolean;
  healthWeightKg: number | null;
  weightKg: number | null;
}) {
  return (settings.healthEnabled ? settings.healthWeightKg : null) ?? settings.weightKg;
}

export function healthDrinkValues(drink: HealthDrink) {
  return {
    waterMl: !drink.deleted && drink.abv === 0 ? drink.volumeMl : 0,
    caffeineMg: drink.deleted ? 0 : drink.caffeineMg,
    // HealthKit uses standard drinks; this app uses the US/NIAAA definition (14 g ethanol).
    standardDrinks: drink.deleted ? 0 : alcoholGrams(drink) / 14,
  };
}

export function healthBacSamples(
  rows: HealthDrink[],
  weightKg: number | null,
  ratio: number | null
) {
  const active = rows.filter((d) => !d.deleted);
  return rows.map((d) => ({
    id: `water-track:bac:${d.id}`,
    time: d.consumedAt,
    // Export event-time estimates, not a stream of invented measurements.
    // HealthKit's percent unit takes fractions: 0.08% is stored as 0.0008.
    fraction:
      !d.deleted && d.abv > 0
        ? (estimateBac(active, weightKg, ratio, d.consumedAt) ?? 0) / 100 || null
        : null,
  }));
}
