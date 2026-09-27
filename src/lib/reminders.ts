import { shiftDays, startOfDay, totals, type Intake } from "./metrics";

// Minutes after local midnight. A bedtime at or before wake-up falls on the next day.
export type ReminderDay = { wake: number; bed: number; off?: boolean };
export type ReminderOptions = {
  goalMl: number;
  glassMl: number;
  morningGlasses: number;
  windDownMinutes: number;
};
export type DayPlan = {
  // Intake counts from midnight of the wake-up date, matching the Today goal.
  dayStart: number;
  wakeAt: number;
  // Wind-down starts here: the whole goal is due and reminders stop until bed.
  cutoffAt: number;
  bedAt: number;
  goalMl: number;
  morningMl: number;
  hourlyMl: number;
};
export type Reminder = {
  time: number;
  kind: "morning" | "hourly";
  targetMl: number;
  deficitMl: number;
};

const DAY_MINUTES = 1440;
const HOUR = 3600000;
export const MAX_AWAKE_MINUTES = 20 * 60;
export const morningGlassOptions = [0, 1, 2, 3, 4];
export const windDownOptions = [60, 90, 120, 180];
export const defaultReminderDay: ReminderDay = { wake: 7 * 60, bed: 22 * 60 };
// Display order for schedule editors: Monday through Sunday, as Date#getDay() indexes.
export const weekOrder = [1, 2, 3, 4, 5, 6, 0];
const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function minuteOfDay(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < DAY_MINUTES
    ? value
    : null;
}

export function normalizeDay(value: unknown): ReminderDay | null {
  if (!value || typeof value !== "object") return null;
  const day = value as Record<string, unknown>;
  const wake = minuteOfDay(day.wake),
    bed = minuteOfDay(day.bed);
  if (wake === null || bed === null) return null;
  return day.off === true ? { wake, bed, off: true } : { wake, bed };
}

export function parseSchedule(json: string | null | undefined): ReminderDay[] {
  let value: unknown = null;
  try {
    value = JSON.parse(json ?? "");
  } catch {
    // Corrupt or missing data falls back to the default day below.
  }
  return Array.from(
    { length: 7 },
    (_, index) =>
      (Array.isArray(value) ? normalizeDay(value[index]) : null) ?? { ...defaultReminderDay }
  );
}

export function awakeMinutes(day: ReminderDay) {
  return (day.bed - day.wake + DAY_MINUTES) % DAY_MINUTES;
}

// At least an hour of drinking before wind-down, and short enough that days cannot overlap.
export function validDay(day: ReminderDay, windDownMinutes: number) {
  const awake = awakeMinutes(day);
  return awake >= windDownMinutes + 60 && awake <= MAX_AWAKE_MINUTES;
}

// Picks the valid wake-up and bedtime pair closest to 16 hours awake. Earlier candidates win ties,
// so callers list the usual reading of an ambiguous time first.
export function likeliestDay(wakes: number[], beds: number[], windDownMinutes: number) {
  let best: ReminderDay | null = null,
    bestDistance = Infinity;
  for (const wake of wakes) {
    for (const bed of beds) {
      const day = { wake, bed };
      const distance = Math.abs(awakeMinutes(day) - 16 * 60);
      if (validDay(day, windDownMinutes) && distance < bestDistance) {
        best = day;
        bestDistance = distance;
      }
    }
  }
  return best;
}

export function sameEveryDay(schedule: ReminderDay[]) {
  const [first] = schedule;
  return schedule.every(
    (day) => day.wake === first.wake && day.bed === first.bed && !!day.off === !!first.off
  );
}

export function dayPlan(
  schedule: ReminderDay[],
  time: number,
  options: ReminderOptions
): DayPlan | null {
  const date = new Date(time);
  const day = schedule[date.getDay()];
  if (!day || day.off || !validDay(day, options.windDownMinutes)) return null;
  const year = date.getFullYear(),
    month = date.getMonth(),
    dayOfMonth = date.getDate();
  // Build wall-clock times with Date so daylight-saving days keep the configured clock times.
  const wakeAt = +new Date(year, month, dayOfMonth, 0, day.wake);
  const bedAt = +new Date(year, month, dayOfMonth + (day.bed > day.wake ? 0 : 1), 0, day.bed);
  const cutoffAt = bedAt - options.windDownMinutes * 60000;
  const goalMl = Math.max(0, options.goalMl);
  const morningMl = Math.min(goalMl, Math.max(0, options.morningGlasses) * options.glassMl);
  return {
    dayStart: +new Date(year, month, dayOfMonth),
    wakeAt,
    cutoffAt,
    bedAt,
    goalMl,
    morningMl,
    hourlyMl: ((goalMl - morningMl) * HOUR) / (cutoffAt - wakeAt),
  };
}

// Morning glasses are due at wake-up, the rest of the goal rises evenly until wind-down.
export function planTarget(plan: DayPlan, time: number) {
  if (time < plan.wakeAt) return 0;
  if (time >= plan.cutoffAt) return plan.goalMl;
  return (
    plan.morningMl +
    ((plan.goalMl - plan.morningMl) * (time - plan.wakeAt)) / (plan.cutoffAt - plan.wakeAt)
  );
}

// Hourly checks from wake-up through the start of wind-down. Notifications are scheduled ahead of
// time, so each one assumes nothing else is logged; callers reschedule whenever intake changes.
export function upcomingReminders(
  rows: Intake[],
  schedule: ReminderDay[],
  options: ReminderOptions,
  now: number,
  limit = 60
) {
  const reminders: Reminder[] = [];
  // Start with yesterday: a bedtime after midnight keeps that plan running into today.
  for (let offset = -1; offset <= 14 && reminders.length < limit; offset++) {
    const plan = dayPlan(schedule, shiftDays(startOfDay(now), offset), options);
    if (!plan) continue;
    const intake = totals(
      rows.filter((d) => d.consumedAt >= plan.dayStart && d.consumedAt <= now)
    ).goalFluid;
    for (let time = plan.wakeAt; time <= plan.cutoffAt; time += HOUR) {
      if (time <= now) continue;
      const morning = time === plan.wakeAt && plan.morningMl > 0;
      const targetMl = planTarget(plan, time);
      const deficitMl = targetMl - intake;
      // Being less than half an hour behind is still on plan.
      if (deficitMl > (morning ? 0.5 : Math.max(0.5, plan.hourlyMl / 2)))
        reminders.push({ time, kind: morning ? "morning" : "hourly", targetMl, deficitMl });
    }
  }
  return reminders.slice(0, limit);
}

export function reminderContent(
  reminder: Reminder,
  text: {
    morningTitle: string;
    morningBody: string;
    title: string;
    body: string;
  },
  volume: (ml: number) => string
) {
  const morning = reminder.kind === "morning";
  return {
    title: morning ? text.morningTitle : text.title,
    body: (morning ? text.morningBody : text.body).replace("{amount}", () =>
      volume(reminder.deficitMl)
    ),
  };
}

function clock(minutes: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export const scheduleInstructions = [
  "You turn a person's description of their routine into a weekly sleep schedule for hydration reminders.",
  "For every day from Sunday to Saturday, give the wake-up time and bedtime on a 24-hour clock.",
  "Weekdays are Monday to Friday; weekends are Saturday and Sunday.",
  "A bedtime after midnight is written as early-morning time, for example 00:30 or 01:00.",
  "Times without am or pm: the wake-up time is in the morning and the bedtime is usually in the evening or just after midnight.",
  "In a range like 7:30 - 8:30, the first time is the wake-up time and the second is the bedtime, so wake 07:30 and bed 20:30.",
  "Midnight is 00:00 and noon is 12:00. Going to bed at midnight is bedHour 0.",
  "Example: '7:30 - 8:30 weekdays and 9:30 - midnight weekends' gives Monday to Friday wake 07:30, bed 20:30, and Saturday and Sunday wake 09:30, bed 00:00.",
  "Keep the current schedule for any day the description does not mention.",
  "Set remindersOff to true only for days the person says should have no reminders.",
].join("\n");

export function schedulePrompt(description: string, schedule: ReminderDay[]) {
  return [
    "Current schedule:",
    ...schedule.map(
      (day, index) =>
        `${weekdayNames[index]}: wake ${clock(day.wake)}, bed ${clock(day.bed)}${day.off ? ", reminders off" : ""}`
    ),
    "",
    "Description:",
    description.trim(),
  ].join("\n");
}

// The model often mixes up am and pm, turning "7:30 - 8:30" into a one-hour day or midnight into
// noon. An invalid day tries the same times 12 hours apart before giving up.
function repairDay(day: ReminderDay, windDownMinutes: number): ReminderDay | null {
  if (validDay(day, windDownMinutes)) return day;
  // As in a description, a wake-up reads as morning first, except in the 12 o'clock hour.
  const wake = day.wake % 720;
  const repaired = likeliestDay(
    wake < 60 ? [wake + 720, wake] : [wake, wake + 720],
    [day.bed, (day.bed + 720) % DAY_MINUTES],
    windDownMinutes
  );
  return repaired && (day.off ? { ...repaired, off: true } : repaired);
}

// Model output is untrusted: days that can't be repaired keep their current times.
export function scheduleFromModel(value: unknown, current: ReminderDay[], windDownMinutes: number) {
  let adjusted = !Array.isArray(value) || value.length !== 7;
  const schedule = current.map((previous, index) => {
    const day = Array.isArray(value) ? normalizeDay(value[index]) : null;
    const repaired = day && repairDay(day, windDownMinutes);
    if (repaired) return repaired;
    adjusted = true;
    return previous;
  });
  return { schedule, adjusted };
}
