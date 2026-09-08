export const OZ_ML = 29.5735295625;
export const LB_KG = 0.45359237;
export const kinds = ["water", "coffee", "tea", "preworkout", "energy", "alcohol"] as const;
export type DrinkKind = (typeof kinds)[number];
export const defaults: Record<DrinkKind, { ml: number; caffeine: number; abv: number }> = {
  water: { ml: 250, caffeine: 0, abv: 0 },
  coffee: { ml: 240, caffeine: 95, abv: 0 },
  tea: { ml: 240, caffeine: 40, abv: 0 },
  preworkout: { ml: 300, caffeine: 200, abv: 0 },
  energy: { ml: 473, caffeine: 160, abv: 0 },
  alcohol: { ml: 355, caffeine: 0, abv: 5 },
};
export type Intake = { volumeMl: number; caffeineMg: number; abv: number; consumedAt: number };
export const alcoholGrams = (d: Intake) => d.volumeMl * (d.abv / 100) * 0.789;
export function totals(rows: Intake[]) {
  return rows.reduce(
    (sum, d) => ({
      fluid: sum.fluid + d.volumeMl,
      goalFluid: sum.goalFluid + (d.abv === 0 ? d.volumeMl : 0),
      caffeine: sum.caffeine + d.caffeineMg,
      alcohol: sum.alcohol + alcoholGrams(d),
    }),
    { fluid: 0, goalFluid: 0, caffeine: 0, alcohol: 0 }
  );
}
export function startOfDay(time: number) {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return +d;
}
export function shiftDays(time: number, days: number) {
  const d = new Date(time);
  d.setDate(d.getDate() + days);
  return +d;
}
export function inDay(time: number, day: number) {
  const start = startOfDay(day);
  return time >= start && time < shiftDays(start, 1);
}
// Widmark approximation with elimination applied once per elapsed interval.
// Whole-dose absorption is assumed; this is not a measurement or a driving aid.
export function estimateBac(
  rows: Intake[],
  weightKg: number | null,
  ratio: number | null,
  now: number
) {
  if (!weightKg || !ratio) return null;
  let bac = 0;
  let previous = 0;
  for (const d of rows
    .filter((d) => d.abv > 0 && d.consumedAt <= now)
    .sort((a, b) => a.consumedAt - b.consumedAt)) {
    bac = Math.max(0, bac - (Math.max(0, d.consumedAt - previous) / 3600000) * 0.015);
    bac += (alcoholGrams(d) / (weightKg * 1000 * ratio)) * 100;
    previous = d.consumedAt;
  }
  return Math.max(0, bac - ((now - previous) / 3600000) * 0.015);
}
export function parseNumber(value: string) {
  if (!/^\d+(?:[.,]\d+)?$/.test(value.trim())) return NaN;
  return Number(value.trim().replace(",", "."));
}
export function localDateTime(time: number) {
  const d = new Date(time);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function parseDateTime(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(value);
  if (!m) return NaN;
  const date = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return localDateTime(+date) === value ? +date : NaN;
}
