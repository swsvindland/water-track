import test from "node:test";
import assert from "node:assert/strict";
import {
  alcoholGrams,
  bacHistory,
  estimateBac,
  inDay,
  localDateTime,
  nearestSize,
  OZ_ML,
  parseDateTime,
  parseNumber,
  shiftDays,
  sizeOptions,
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
  assert.ok(
    Math.abs(estimateBac([d], 70, 0.68, now) - ((alcoholGrams(d) * 1.055) / 476 - 0.015)) < 1e-10
  );
});
test("BAC eliminates once per time interval and handles unsorted logs", () => {
  const a = drink(),
    b = drink({ consumedAt: a.consumedAt + 3600000 });
  const result = estimateBac([b, a], 70, 0.68, b.consumedAt);
  assert.ok(Math.abs(result - ((2 * alcoholGrams(a) * 1.055) / 476 - 0.015)) < 1e-10);
  assert.equal(estimateBac([a, b], 70, 0.68, b.consumedAt + 86400000), 0);
  assert.equal(estimateBac([b], 70, 0.68, a.consumedAt), 0);
});
test("BAC is reported in g/100 mL: Widmark mass concentration times blood density", () => {
  // 14 g of ethanol (one US standard drink) for 70 kg at r = 0.68:
  // 14 / (70,000 g × 0.68) = 0.0294 g/100 g, × 1.055 g/mL ≈ 0.0310 g/100 mL.
  const standard = drink({ volumeMl: 14 / 0.789 / 0.05 });
  assert.ok(Math.abs(alcoholGrams(standard) - 14) < 1e-10);
  const peak = estimateBac([standard], 70, 0.68, standard.consumedAt);
  assert.ok(Math.abs(peak - 0.031029) < 1e-6, String(peak));
  // Two hours later, 0.030 percentage points have been eliminated.
  const later = estimateBac([standard], 70, 0.68, standard.consumedAt + 2 * 3600000);
  assert.ok(Math.abs(later - (peak - 0.03)) < 1e-10);
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

test("BAC trend includes carryover and matches the current estimate as time advances", () => {
  const now = drink().consumedAt;
  const rows = [
    drink({ consumedAt: now - 8 * 3600000, volumeMl: 2000, abv: 12 }),
    drink({ consumedAt: now - 3600000 }),
    drink({ consumedAt: now + 3600000 }),
  ];
  for (const elapsed of [0, 1000, 3600000, 86400000]) {
    const at = now + elapsed;
    const points = bacHistory(rows, 70, 0.68, at);
    assert.equal(points[0].time, at - 6 * 3600000);
    assert.equal(points.at(-1).time, at);
    assert.ok(Math.abs(points.at(-1).value - estimateBac(rows, 70, 0.68, at)) < 1e-10);
    assert.ok(points.every((point) => point.value >= 0 && point.time <= at));
  }
  assert.ok(bacHistory(rows, 70, 0.68, now)[0].value > 0);
  assert.deepEqual(bacHistory(rows, null, 0.68, now), []);
});
test("BAC trend preserves drink jumps and flat zero intervals", () => {
  const first = drink();
  const second = drink({ consumedAt: first.consumedAt + 4 * 3600000 });
  const points = bacHistory([second, first], 70, 0.68, second.consumedAt + 1000);
  const jump = points.filter((point) => point.time === second.consumedAt);
  assert.equal(jump[0].value, 0);
  assert.ok(jump[1].value > 0);
  assert.ok(
    points.some(
      (point) =>
        point.value === 0 && point.time > first.consumedAt && point.time < second.consumedAt
    )
  );
  assert.ok(points.at(-1).value < jump[1].value);
  assert.equal(bacHistory([first], 70, 0.68, first.consumedAt + 86400000).at(-1).value, 0);
});

test("size options snap to common serving sizes and keep a custom current size", () => {
  const us = sizeOptions("us", 8 * OZ_ML);
  assert.deepEqual(
    us.map((ml) => Math.round(ml / OZ_ML)),
    [1, 2, 4, 6, 8, 12, 16, 20, 24, 28, 32, 40, 64]
  );
  const metric = sizeOptions("metric", 355);
  assert.equal(metric.length, 16);
  assert.equal(metric[nearestSize(metric, 355)], 355);
  assert.equal(metric[nearestSize(metric, 340)], 330);
  assert.deepEqual(sizeOptions("metric", 250), sizeOptions("metric", Number.NaN));
});
