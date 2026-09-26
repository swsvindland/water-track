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
// Values created inside the VM have their own prototypes; compare plain copies.
const plain = (value) => JSON.parse(JSON.stringify(value));

const at = (day, hour, minute = 0) => new Date(2026, 8, day, hour, minute).getTime();
const everyDay = (day) => Array.from({ length: 7 }, () => ({ ...day }));
const options = { goalMl: 2500, glassMl: 250, morningGlasses: 2, windDownMinutes: 120 };
const water = (consumedAt, volumeMl = 250, abv = 0) => ({
  volumeMl,
  caffeineMg: 0,
  abv,
  consumedAt,
});
const week = everyDay({ wake: 7 * 60, bed: 22 * 60 });

test("schedules parse safely and keep per-day reminder switches", () => {
  const fallback = plain(reminders.parseSchedule("not json"));
  assert.equal(fallback.length, 7);
  assert.ok(fallback.every((day) => day.wake === 420 && day.bed === 1320 && !day.off));
  const parsed = plain(
    reminders.parseSchedule(
      JSON.stringify([
        { wake: 540, bed: 30, off: true },
        { wake: 390, bed: 1350 },
        { wake: -1, bed: 1320 },
        { wake: 1440, bed: 60 },
        { wake: 420.5, bed: 60 },
        null,
      ])
    )
  );
  assert.deepEqual(parsed[0], { wake: 540, bed: 30, off: true });
  assert.deepEqual(parsed[1], { wake: 390, bed: 1350 });
  for (const index of [2, 3, 4, 5, 6]) assert.deepEqual(parsed[index], { wake: 420, bed: 1320 });
  assert.equal(reminders.sameEveryDay(parsed), false);
  assert.equal(reminders.sameEveryDay(week), true);
});

test("days need an hour before wind-down and at most 20 hours awake", () => {
  assert.equal(reminders.validDay({ wake: 420, bed: 600 }, 120), true);
  assert.equal(reminders.validDay({ wake: 420, bed: 595 }, 120), false);
  assert.equal(reminders.validDay({ wake: 420, bed: 420 }, 60), false);
  assert.equal(reminders.validDay({ wake: 600, bed: 360 }, 60), true);
  assert.equal(reminders.validDay({ wake: 600, bed: 365 }, 60), false);
  assert.equal(reminders.awakeMinutes({ wake: 22 * 60, bed: 60 }), 180);
});

test("the plan starts with morning glasses and reaches the goal at wind-down", () => {
  const plan = reminders.dayPlan(week, at(14, 12), options);
  assert.equal(plan.wakeAt, at(14, 7));
  assert.equal(plan.cutoffAt, at(14, 20));
  assert.equal(plan.bedAt, at(14, 22));
  assert.equal(plan.dayStart, at(14, 0));
  assert.equal(plan.morningMl, 500);
  assert.ok(Math.abs(plan.hourlyMl - 2000 / 13) < 1e-9);
  assert.equal(reminders.planTarget(plan, at(14, 6, 59)), 0);
  assert.equal(reminders.planTarget(plan, at(14, 7)), 500);
  assert.ok(Math.abs(reminders.planTarget(plan, at(14, 13, 30)) - 1500) < 1e-9);
  assert.equal(reminders.planTarget(plan, at(14, 20)), 2500);
  assert.equal(reminders.planTarget(plan, at(14, 21, 59)), 2500);
  const small = reminders.dayPlan(week, at(14, 12), { ...options, goalMl: 300 });
  assert.equal(small.morningMl, 300);
  assert.equal(small.hourlyMl, 0);
});

test("bedtimes after midnight, days off, and invalid days", () => {
  const late = everyDay({ wake: 10 * 60, bed: 60 });
  const plan = reminders.dayPlan(late, at(14, 12), options);
  assert.equal(plan.bedAt, at(15, 1));
  assert.equal(plan.cutoffAt, at(14, 23));
  const off = everyDay({ wake: 420, bed: 1320 });
  off[new Date(at(14, 12)).getDay()].off = true;
  assert.equal(reminders.dayPlan(off, at(14, 12), options), null);
  assert.equal(reminders.dayPlan(everyDay({ wake: 420, bed: 540 }), at(14, 12), options), null);
});

test("daylight-saving days keep wall-clock wake and bed times", () => {
  const spring = new Date(2026, 2, 8, 12).getTime();
  const plan = reminders.dayPlan(week, spring, options);
  assert.equal(new Date(plan.wakeAt).getHours(), 7);
  assert.equal(new Date(plan.bedAt).getHours(), 22);
  assert.equal(plan.dayStart, new Date(2026, 2, 8).getTime());
});

test("with nothing logged, reminders run hourly from wake-up until wind-down", () => {
  const upcoming = plain(reminders.upcomingReminders([], week, options, at(14, 6)));
  assert.equal(upcoming.length, 60);
  assert.deepEqual(upcoming[0], {
    time: at(14, 7),
    kind: "morning",
    targetMl: 500,
    deficitMl: 500,
  });
  const today = upcoming.filter((r) => r.time < at(15, 0));
  assert.deepEqual(
    today.map((r) => new Date(r.time).getHours()),
    [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
  );
  assert.ok(today.slice(1).every((r) => r.kind === "hourly"));
  assert.equal(today.at(-1).deficitMl, 2500);
  assert.equal(upcoming[14].time, at(15, 7));
  assert.ok(upcoming.every((r, i) => i === 0 || r.time > upcoming[i - 1].time));
});

test("reminders are skipped while intake is on plan and resume when it falls behind", () => {
  const plan = reminders.dayPlan(week, at(14, 12), options);
  const onPlan = [
    water(at(14, 7, 5), 500),
    water(at(14, 12, 30), reminders.planTarget(plan, at(14, 13)) - 500),
  ];
  const upcoming = plain(reminders.upcomingReminders(onPlan, week, options, at(14, 12, 30), 3));
  assert.deepEqual(
    upcoming.map((r) => new Date(r.time).getHours()),
    [14, 15, 16]
  );
  assert.ok(Math.abs(upcoming[0].deficitMl - plan.hourlyMl) < 1e-9);
  // Less than half an hour behind still counts as on plan.
  const slightlyBehind = [water(at(14, 12), reminders.planTarget(plan, at(14, 13)) - 70)];
  assert.equal(
    new Date(
      reminders.upcomingReminders(slightlyBehind, week, options, at(14, 12, 30), 1)[0].time
    ).getHours(),
    14
  );
  const behind = [water(at(14, 12), reminders.planTarget(plan, at(14, 13)) - 100)];
  assert.equal(
    new Date(
      reminders.upcomingReminders(behind, week, options, at(14, 12, 30), 1)[0].time
    ).getHours(),
    13
  );
});

test("morning glasses logged before the alarm, the goal met, alcohol, and yesterday's drinks", () => {
  const early = [water(at(14, 6, 45), 500)];
  const first = reminders.upcomingReminders(early, week, options, at(14, 6, 50), 1)[0];
  assert.equal(first.kind, "hourly");
  assert.equal(first.time, at(14, 8));
  const done = [water(at(14, 9), 2500)];
  assert.equal(reminders.upcomingReminders(done, week, options, at(14, 10), 1)[0].time, at(15, 7));
  const beer = [water(at(14, 6, 45), 500, 5)];
  assert.equal(
    reminders.upcomingReminders(beer, week, options, at(14, 6, 50), 1)[0].kind,
    "morning"
  );
  const yesterday = [water(at(13, 23), 2500)];
  assert.equal(
    reminders.upcomingReminders(yesterday, week, options, at(14, 6), 1)[0].time,
    at(14, 7)
  );
});

test("a plan past midnight keeps reminding with the previous day's intake", () => {
  const late = everyDay({ wake: 12 * 60, bed: 3 * 60 });
  const lateOptions = { ...options, windDownMinutes: 60 };
  const upcoming = plain(
    reminders.upcomingReminders([water(at(13, 13), 500)], late, lateOptions, at(14, 0, 30), 3)
  );
  assert.deepEqual(
    upcoming.map((r) => r.time),
    [at(14, 1), at(14, 2), at(14, 12)]
  );
  assert.equal(
    upcoming[0].deficitMl,
    reminders.planTarget(reminders.dayPlan(late, at(13, 12), lateOptions), at(14, 1)) - 500
  );
  assert.equal(upcoming[2].kind, "morning");
});

test("days off are skipped and zero morning glasses start with hourly checks", () => {
  const schedule = everyDay({ wake: 420, bed: 1320 });
  schedule[new Date(at(15, 12)).getDay()].off = true;
  const upcoming = reminders.upcomingReminders([], schedule, options, at(14, 21), 20);
  assert.ok(upcoming.every((r) => r.time < at(15, 0) || r.time >= at(16, 0)));
  assert.equal(upcoming[0].time, at(16, 7));
  const none = reminders.upcomingReminders(
    [],
    week,
    { ...options, morningGlasses: 0 },
    at(14, 6),
    2
  );
  assert.deepEqual(
    plain(none).map((r) => [new Date(r.time).getHours(), r.kind]),
    [
      [8, "hourly"],
      [9, "hourly"],
    ]
  );
});

test("notification text fills in the amount behind", () => {
  const text = {
    morningTitle: "Good morning",
    morningBody: "Start your day with {amount} of water.",
    title: "Time for water",
    body: "You're {amount} behind your plan.",
  };
  const volume = (ml) => `${Math.round(ml)} mL`;
  assert.deepEqual(
    plain(reminders.reminderContent({ kind: "morning", deficitMl: 500 }, text, volume)),
    { title: "Good morning", body: "Start your day with 500 mL of water." }
  );
  assert.deepEqual(
    plain(reminders.reminderContent({ kind: "hourly", deficitMl: 153.8 }, text, volume)),
    { title: "Time for water", body: "You're 154 mL behind your plan." }
  );
});

test("Apple Intelligence prompts carry the current week and output is validated", () => {
  const current = everyDay({ wake: 420, bed: 1320 });
  current[0] = { wake: 540, bed: 30, off: true };
  const prompt = reminders.schedulePrompt("  Weekends I sleep in until 9.  ", current);
  assert.match(
    prompt,
    /^Current schedule:\nSunday: wake 09:00, bed 00:30, reminders off\nMonday: wake 07:00, bed 22:00/
  );
  assert.match(prompt, /Description:\nWeekends I sleep in until 9\.$/);
  const generated = everyDay({ wake: 390, bed: 1350, off: false });
  generated[6] = { wake: 540, bed: 0, off: true };
  assert.deepEqual(plain(reminders.scheduleFromModel(generated, current, 120)), {
    schedule: [...everyDay({ wake: 390, bed: 1350 }).slice(0, 6), { wake: 540, bed: 0, off: true }],
    adjusted: false,
  });
  generated[2] = { wake: 420, bed: 480 };
  generated[3] = { wake: "7", bed: 1320 };
  const adjusted = plain(reminders.scheduleFromModel(generated, current, 120));
  assert.equal(adjusted.adjusted, true);
  assert.deepEqual(adjusted.schedule[2], current[2]);
  assert.deepEqual(adjusted.schedule[3], current[3]);
  assert.deepEqual(adjusted.schedule[1], { wake: 390, bed: 1350 });
  assert.deepEqual(plain(reminders.scheduleFromModel(null, current, 120)), {
    schedule: plain(current),
    adjusted: true,
  });
});
