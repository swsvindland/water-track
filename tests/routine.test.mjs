import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(file, mocks = {}) {
  const url = new URL(`../src/lib/${file}.ts`, import.meta.url);
  const exports = {};
  const require = createRequire(url);
  const code = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, {
    exports,
    Date,
    require: (id) => (Object.hasOwn(mocks, id) ? mocks[id] : require(id)),
  });
  return exports;
}
const metrics = load("metrics");
const reminders = load("reminders", { "./metrics": metrics });
const routine = load("routine", { "./reminders": reminders });
// Values created inside the VM have their own prototypes; compare plain copies.
const plain = (value) => JSON.parse(JSON.stringify(value));

const time = (text) => {
  const [hour, minute] = text.split(":").map(Number);
  return hour * 60 + minute;
};
const day = (wake, bed) => ({ wake: time(wake), bed: time(bed) });
const OFF = "off";
// Days are listed Sunday first, matching Date#getDay().
const week = (...days) =>
  days.map((entry) => (entry === OFF ? OFF : Array.isArray(entry) ? day(...entry) : entry));
const current = Array.from({ length: 7 }, () => day("07:00", "22:00"));
const weekdays = (wake, bed) => [1, 2, 3, 4, 5].map(() => [wake, bed]);

// Off days keep their previous times, so compare them by flag only.
function parse(description, { from = current, windDown = 120 } = {}) {
  const result = routine.parseRoutine(description, from, windDown);
  return result && plain(result);
}
function expectWeek(description, expected, options) {
  const result = parse(description, options);
  assert.ok(result, `"${description}" should be understood`);
  assert.equal(result.adjusted, false, `"${description}" should not need adjusting`);
  assert.deepEqual(
    result.schedule.map((entry) => (entry.off ? OFF : entry)),
    week(...expected),
    description
  );
}

test("ranges without am or pm read as a morning wake-up and an evening bedtime", () => {
  const expected = [["09:30", "00:00"], ...weekdays("07:30", "20:30"), ["09:30", "00:00"]];
  for (const description of [
    "7:30 -8:30 weekdays and 9:30 - midnight weekends",
    "7:30-8:30 weekdays, 9:30-midnight weekends",
    "Weekdays 7:30 - 8:30, weekends 9:30 - midnight",
    "Weekdays 7:30 to 8:30 and weekends 9:30 until midnight.",
    "7:30 to 8:30 on weekdays, and 9:30 to midnight on weekends",
    "Monday to Friday 7:30-8:30. Saturday and Sunday 9:30-12",
    "M-F 7:30–8:30, Sat/Sun 9:30–12",
    "Weekdays: 7:30am-8:30pm; weekends: 9:30am-12am",
    "weekdays 07:30-20:30, weekends 09:30-00:00",
    "Weekdays 7:30 in the morning to 8:30 in the evening. Weekends 9:30 to 12 at night",
  ])
    expectWeek(description, expected);
});

test("the placeholder routine and other wake-up and bedtime phrasing", () => {
  expectWeek(
    "Up at 6:30 on weekdays, in bed by 10:30. Weekends I sleep until 9 and go to bed around midnight.",
    [["09:00", "00:00"], ...weekdays("06:30", "22:30"), ["09:00", "00:00"]]
  );
  const everyDay = (wake, bed) => Array.from({ length: 7 }, () => [wake, bed]);
  expectWeek("I wake up at 7 and go to bed at 11", everyDay("07:00", "23:00"));
  expectWeek("Every day 6-10", everyDay("06:00", "22:00"));
  expectWeek("7:30 - 8:30", everyDay("07:30", "20:30"));
  expectWeek("9ish to 11ish", everyDay("09:00", "23:00"));
  expectWeek("between 8 and 11", everyDay("08:00", "23:00"));
  expectWeek("I sleep from 11 to 7", everyDay("07:00", "23:00"));
  expectWeek("sleep 11pm to 7am", everyDay("07:00", "23:00"));
  // Only the named part of the day changes.
  expectWeek("Weekends I sleep in until 9", [
    ["09:00", "22:00"],
    ...weekdays("07:00", "22:00"),
    ["09:00", "22:00"],
  ]);
  expectWeek("Fridays and Saturdays I stay up until 1", [
    ["07:00", "22:00"],
    ...weekdays("07:00", "22:00").slice(0, 4),
    ["07:00", "01:00"],
    ["07:00", "01:00"],
  ]);
  // A sentence without days continues the previous one.
  expectWeek("Weekdays I get up at 6. I go to bed at 10.", [
    ["07:00", "22:00"],
    ...weekdays("06:00", "22:00"),
    ["07:00", "22:00"],
  ]);
  expectWeek("Up at 7 a.m. Weekends 9-12", [
    ["09:00", "00:00"],
    ...weekdays("07:00", "22:00"),
    ["09:00", "00:00"],
  ]);
});

test("ambiguous hours pick the most plausible day", () => {
  const first = (description, options) => parse(description, options).schedule[1];
  // Noon to 4 am rather than midnight to 4 pm.
  assert.deepEqual(first("12-4"), day("12:00", "04:00"));
  assert.deepEqual(first("10-2"), day("10:00", "02:00"));
  assert.deepEqual(first("wake at 12:30"), day("12:30", "22:00"));
  // An explicit morning bedtime makes an unmarked wake-up the afternoon.
  assert.deepEqual(first("wake at 3, bed at 7am"), day("15:00", "07:00"));
  // A wake-up on its own is checked against the bedtime already set.
  const late = Array.from({ length: 7 }, () => day("10:00", "02:00"));
  assert.deepEqual(first("wake at 11", { from: late }), day("11:00", "02:00"));
  // Explicit times are never reinterpreted.
  assert.deepEqual(first("7pm to 3am"), day("19:00", "03:00"));
  assert.deepEqual(first("7:30am-8:30am"), day("07:00", "22:00"));
  assert.equal(parse("7:30am-8:30am").adjusted, true);
});

test("day lists, ranges, exceptions and the rest of the week", () => {
  expectWeek("mon, wed, fri 6-10", [
    ["07:00", "22:00"],
    ["06:00", "22:00"],
    ["07:00", "22:00"],
    ["06:00", "22:00"],
    ["07:00", "22:00"],
    ["06:00", "22:00"],
    ["07:00", "22:00"],
  ]);
  expectWeek("tue-thu 6-10", [
    ["07:00", "22:00"],
    ["07:00", "22:00"],
    ["06:00", "22:00"],
    ["06:00", "22:00"],
    ["06:00", "22:00"],
    ["07:00", "22:00"],
    ["07:00", "22:00"],
  ]);
  // Ranges wrap around the end of the week.
  expectWeek("fri-sun 9-1", [
    ["09:00", "01:00"],
    ...weekdays("07:00", "22:00").slice(0, 4),
    ["09:00", "01:00"],
    ["09:00", "01:00"],
  ]);
  expectWeek("every day except sunday 6-10", [
    ["07:00", "22:00"],
    ...weekdays("06:00", "22:00"),
    ["06:00", "22:00"],
  ]);
  // A later, narrower clause overrides an earlier one.
  expectWeek("weekdays 7:30 - 8:30 except friday 7:30-midnight", [
    ["07:00", "22:00"],
    ...weekdays("07:30", "20:30").slice(0, 4),
    ["07:30", "00:00"],
    ["07:00", "22:00"],
  ]);
  expectWeek("Weekdays 6:30 to 10:30, otherwise 9 to midnight", [
    ["09:00", "00:00"],
    ...weekdays("06:30", "22:30"),
    ["09:00", "00:00"],
  ]);
  expectWeek("Up at 6 on work days", [
    ["07:00", "22:00"],
    ...weekdays("06:00", "22:00"),
    ["07:00", "22:00"],
  ]);
});

test("days can be switched off and back on", () => {
  expectWeek("7-11 weekdays, weekends off", [OFF, ...weekdays("07:00", "23:00"), OFF]);
  expectWeek("No reminders on Sundays", [OFF, ...weekdays("07:00", "22:00"), ["07:00", "22:00"]]);
  expectWeek("I don't want reminders on weekends. Weekdays 6-10.", [
    OFF,
    ...weekdays("06:00", "22:00"),
    OFF,
  ]);
  // An off day keeps its times, and describing new times turns it back on.
  const sundayOff = [{ wake: 540, bed: 30, off: true }, ...current.slice(1)];
  assert.deepEqual(parse("Sundays off").schedule[0], { wake: 420, bed: 1320, off: true });
  assert.deepEqual(parse("Weekdays 6-10", { from: sundayOff }).schedule[0], sundayOff[0]);
  assert.deepEqual(parse("Sundays 9-11", { from: sundayOff }).schedule[0], day("09:00", "23:00"));
});

test("days that still don't fit keep their times and are reported", () => {
  // Three hours awake leaves no drinking time before a three-hour wind-down.
  const result = parse("Saturday 7pm-10pm, Sunday 8-11", { windDown: 180 });
  assert.equal(result.adjusted, true);
  assert.deepEqual(result.schedule[6], current[6]);
  assert.deepEqual(result.schedule[0], day("08:00", "23:00"));
});

test("anything not fully understood is left to Apple Intelligence", () => {
  for (const description of [
    "",
    "   ",
    "Weekends I sleep in",
    "I get 8 hours of sleep",
    "Weekends an hour later",
    "Up before 7 on weekdays",
    "weekdays 6-10 or 7-11",
    "Wochentags 7:30 bis 20:30",
    "Entre semana de 7:30 a 20:30",
    "平日は7:30から20:30",
    "school nights 10",
    "weekdays 7, weekends 9",
    "7 weekdays",
    "Saturday",
    "Weekdays 25:00-8:00",
    "weekdays 7:75-10",
    "wake at 13pm",
    "2230",
    "no reminders on weekends 9-12",
    "wake at 7 and wake at 8",
    "go to bed",
  ])
    assert.equal(parse(description), null, description);
});
