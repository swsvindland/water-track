import test from "node:test";
import assert from "node:assert/strict";
import {
  alcoholGrams,
  estimateBac,
  inDay,
  localDateTime,
  OZ_ML,
  parseDateTime,
  parseNumber,
  shiftDays,
  startOfDay,
  totals,
} from "../src/lib/metrics.ts";
const drink = (overrides = {}) => ({
  volumeMl: 355,
  caffeineMg: 0,
  abv: 5,
  consumedAt: new Date(2026, 8, 7, 23, 30).getTime(),
  ...overrides,
});
test("US fluid ounces convert precisely", () =>
  assert.ok(Math.abs(12 * OZ_ML - 354.88235475) < 0.00001));
test("fluids include alcohol; goal fluids exclude it, coffee still counts", () => {
  const result = totals([drink(), drink({ abv: 0, volumeMl: 240, caffeineMg: 95 })]);
  assert.equal(result.fluid, 595);
  assert.equal(result.goalFluid, 240);
  assert.equal(result.caffeine, 95);
  assert.ok(Math.abs(result.alcohol - 14.00475) < 0.00001);
});
test("BAC requires profile and carries alcohol across midnight", () => {
  const d = drink();
  const now = d.consumedAt + 3600000;
  assert.equal(estimateBac([d], null, 0.68, now), null);
  assert.ok(Math.abs(estimateBac([d], 70, 0.68, now) - (alcoholGrams(d) / 476 - 0.015)) < 1e-10);
});
test("BAC eliminates once per time interval and handles unsorted logs", () => {
  const a = drink(),
    b = drink({ consumedAt: a.consumedAt + 3600000 });
  const result = estimateBac([b, a], 70, 0.68, b.consumedAt);
  assert.ok(Math.abs(result - ((2 * alcoholGrams(a)) / 476 - 0.015)) < 1e-10);
  assert.equal(estimateBac([a, b], 70, 0.68, b.consumedAt + 86400000), 0);
  assert.equal(estimateBac([b], 70, 0.68, a.consumedAt), 0);
});
test("local day boundaries exclude exactly next midnight", () => {
  const d = drink().consumedAt;
  const start = startOfDay(d);
  assert.equal(inDay(start, d), true);
  assert.equal(inDay(shiftDays(start, 1), d), false);
});
test("calendar days handle daylight saving changes", () => {
  const spring = new Date(2026, 2, 8).getTime();
  assert.equal(shiftDays(spring, 1) - spring, 23 * 3600000);
  const fall = new Date(2026, 10, 1).getTime();
  assert.equal(shiftDays(fall, 1) - fall, 25 * 3600000);
});
test("numbers accept decimal comma and reject junk or blanks", () => {
  assert.equal(parseNumber("12,5"), 12.5);
  for (const value of ["", " ", "-5", "12oz", "Infinity", "1,2,3"])
    assert.ok(Number.isNaN(parseNumber(value)));
});
test("date validation rejects overflow and round-trips local time", () => {
  assert.ok(Number.isNaN(parseDateTime("2026-02-30 12:00")));
  assert.ok(Number.isNaN(parseDateTime("2026-09-08 25:00")));
  assert.equal(localDateTime(parseDateTime("2026-09-08 12:30")), "2026-09-08 12:30");
});
