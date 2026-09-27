import { likeliestDay, type ReminderDay } from "./reminders";

// Reads plain English routines such as "7:30-8:30 weekdays, 9:30 to midnight weekends" without the
// on-device model, which often misreads 12-hour times. Any word it doesn't know makes it return
// null, so descriptions it can't fully understand still go to Apple Intelligence.

type Time = { hour: number; minute: number; meridiem?: "am" | "pm"; fixed?: boolean };
type Mask = number | "rest";
type Item =
  | { kind: "days"; mask: Mask; single?: number }
  | { kind: "time"; time: Time }
  | {
      kind:
        "wake" | "bed" | "off" | "range" | "list" | "comma" | "or" | "except" | "between" | "stop";
    };
type Spec = { wake?: Time; bed?: Time; loose: Time[] };
type Clause = { mask: Mask; off: boolean; wake?: Time; bed?: Time };

const ALL = 127;
const WEEKDAYS = 0b0111110;
const WEEKENDS = 0b1000001;
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const SHORT_NAMES = [
  ["sun"],
  ["mon"],
  ["tue", "tues"],
  ["wed", "weds"],
  ["thu", "thur", "thurs"],
  ["fri"],
  ["sat"],
];
const dayWords = new Map<string, number>();
DAY_NAMES.forEach((name, day) => {
  for (const word of [name, `${name}s`, ...SHORT_NAMES[day]]) dayWords.set(word, day);
});
const groupWords = new Map([
  ["weekday", WEEKDAYS],
  ["weekdays", WEEKDAYS],
  ["workday", WEEKDAYS],
  ["workdays", WEEKDAYS],
  ["weekend", WEEKENDS],
  ["weekends", WEEKENDS],
  ["daily", ALL],
  ["everyday", ALL],
  ["nightly", ALL],
]);
const wakeWords = new Set([
  "wake",
  "wakes",
  "waking",
  "woke",
  "awake",
  "up",
  "rise",
  "rises",
  "rising",
  "alarm",
  "alarms",
]);
const bedWords = new Set(["bed", "beds", "bedtime", "asleep", "sleep", "sleeps", "sleeping"]);
const offWords = new Set([
  "off",
  "no",
  "skip",
  "without",
  "disable",
  "pause",
  "stop",
  "don't",
  "dont",
  "not",
  "never",
  "quiet",
  "mute",
  "silence",
]);
const rangeWords = new Set(["to", "until", "till", "til", "through", "thru"]);
const exceptWords = new Set(["except", "but", "excluding", "besides"]);
const periodWords = new Set(["day", "days", "night", "nights"]);
const fillerWords = new Set(
  (
    "i i'm im i'll i'd my me we we're us our you it it's its is are am be was will would like " +
    "usually normally typically generally mostly always often regularly get gets getting go goes " +
    "going head heads at around about approximately approx roughly by on in the a an and then so " +
    "for from of work o'clock oclock ish time day days night nights week weeks morning mornings " +
    "evening evenings also too just reminders reminder notifications notification remind want " +
    "please turn any set schedule have with every each all"
  ).split(" ")
);

const timePattern =
  /(\d{1,2})(?:[:.](\d{2}))?(?:\s*([ap])(?:m|\.m\.)|([ap]))?(?:\s*ish)?(?![a-z\d])/y;
const wordPattern = /[a-z]+(?:'[a-z]+)?/y;

type Token = { word: string } | { time: Time } | { symbol: Item["kind"] };

function lex(text: string): Token[] | null {
  const original = text
    .replace(/[‐-―−]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/\bm\s*-\s*f\b/gi, "weekdays");
  const source = original.toLowerCase();
  const tokens: Token[] = [];
  let index = 0;
  const match = (pattern: RegExp) => {
    pattern.lastIndex = index;
    const result = pattern.exec(source);
    if (result) index = pattern.lastIndex;
    return result;
  };
  while (index < source.length) {
    const char = source[index];
    if (/[.;!?\n]/.test(char)) tokens.push({ symbol: "stop" });
    else if (char === "-") tokens.push({ symbol: "range" });
    else if (char === "," || char === ":") tokens.push({ symbol: "comma" });
    else if (char === "&") tokens.push({ symbol: "list" });
    else if (char === "/") tokens.push({ symbol: "or" });
    else if (!/[\s~()"]/.test(char)) {
      const time = match(timePattern);
      if (time) {
        const hour = Number(time[1]),
          minute = Number(time[2] ?? 0),
          letter = time[3] ?? time[4];
        if (minute > 59) return null;
        if (letter) {
          if (hour < 1 || hour > 12) return null;
          tokens.push({ time: { hour, minute, meridiem: letter === "a" ? "am" : "pm" } });
          // The last dot of "7 a.m. Weekends…" also ends the sentence.
          if (time[0].endsWith(".") && /^\s+[A-Z]/.test(original.slice(index)))
            tokens.push({ symbol: "stop" });
        } else {
          if (hour > 24 || (hour === 24 && minute > 0)) return null;
          // 0:30, 07:30 and 19:00 are already on a 24-hour clock.
          const fixed = hour === 0 || hour >= 13 || time[1].startsWith("0");
          tokens.push({ time: { hour: hour % 24, minute, fixed } });
        }
        continue;
      }
      const word = match(wordPattern);
      if (!word) return null;
      tokens.push({ word: word[0] });
      continue;
    }
    index++;
  }
  return tokens;
}

function items(tokens: Token[]): Item[] | null {
  const result: Item[] = [];
  const word = (offset: number) => {
    const token = tokens[offset];
    return token && "word" in token ? token.word : "";
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if ("symbol" in token) {
      result.push({ kind: token.symbol } as Item);
      continue;
    }
    if ("time" in token) {
      const time = { ...token.time };
      // "8:30 in the evening", "10 at night"
      let j = i + 1;
      while (["in", "the", "at"].includes(word(j))) j++;
      const period = word(j);
      if (j > i + 1 || period === "tonight") {
        const night = period === "night" || period === "tonight";
        const meridiem =
          // "12 at night" is midnight.
          period === "morning" || (night && time.hour === 12)
            ? "am"
            : night || period === "afternoon" || period === "evening"
              ? "pm"
              : undefined;
        if (meridiem && !time.fixed && !time.meridiem) {
          time.meridiem = meridiem;
          i = j;
        }
      }
      result.push({ kind: "time", time });
      continue;
    }
    const current = token.word,
      next = word(i + 1);
    const day = dayWords.get(current);
    if (day !== undefined) result.push({ kind: "days", mask: 1 << day, single: day });
    else if (groupWords.has(current)) result.push({ kind: "days", mask: groupWords.get(current)! });
    else if (
      ["every", "each", "all"].includes(current) &&
      (periodWords.has(next) || next === "week")
    ) {
      result.push({ kind: "days", mask: ALL });
      i++;
    } else if (current === "work" && (next === "day" || next === "days")) {
      result.push({ kind: "days", mask: WEEKDAYS });
      i++;
    } else if (current === "other" && periodWords.has(next)) {
      result.push({ kind: "days", mask: "rest" });
      i++;
    } else if (current === "otherwise" || current === "rest")
      result.push({ kind: "days", mask: "rest" });
    else if (current === "noon" || current === "midday")
      result.push({ kind: "time", time: { hour: 12, minute: 0, fixed: true } });
    else if (current === "midnight")
      result.push({ kind: "time", time: { hour: 0, minute: 0, fixed: true } });
    else if (["stay", "stays", "staying"].includes(current) && next === "up") {
      result.push({ kind: "bed" });
      i++;
    } else if ((current === "up" || current === "awake") && rangeWords.has(next) && next !== "to") {
      // "up until 1" is a bedtime.
      result.push({ kind: "bed" });
      i++;
    } else if (["lights", "turn"].includes(current) && (next === "out" || next === "in")) {
      result.push({ kind: "bed" });
      i++;
    } else if (current === "out" && next === "of" && word(i + 2) === "bed") {
      result.push({ kind: "wake" });
      i += 2;
    } else if (
      ["sleep", "sleeps", "sleeping"].includes(current) &&
      ["in", ...rangeWords].includes(next)
    ) {
      // "sleep in until 9" and "sleep until 9" are about waking up.
      result.push({ kind: "wake" });
      i += next === "in" && rangeWords.has(word(i + 2)) ? 2 : 1;
    } else if (wakeWords.has(current)) result.push({ kind: "wake" });
    else if (bedWords.has(current)) result.push({ kind: "bed" });
    else if (offWords.has(current)) result.push({ kind: "off" });
    else if (rangeWords.has(current)) result.push({ kind: "range" });
    else if (exceptWords.has(current)) result.push({ kind: "except" });
    else if ((current === "apart" && next === "from") || (current === "other" && next === "than")) {
      result.push({ kind: "except" });
      i++;
    } else if (current === "between") result.push({ kind: "between" });
    else if (current === "and" || current === "plus") result.push({ kind: "list" });
    else if (current === "or") result.push({ kind: "or" });
    else if (!fillerWords.has(current)) return null;
  }
  return result;
}

// Joins "saturday and sunday", "mon-fri" and "every day except sunday" into one set of days.
function mergeDays(list: Item[]): Item[] | null {
  const result: Item[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (item.kind === "or") return null;
    if (item.kind !== "days" || item.mask === "rest") {
      result.push(item);
      continue;
    }
    let mask = item.mask,
      last = item.single,
      subtract = false;
    // In "7-11 weekdays, weekends off" the comma ends the weekdays; in "sat, sun 9-12" it doesn't.
    const afterTime = result.at(-1)?.kind === "time";
    for (;;) {
      const link = list[i + 1],
        next = list[i + 2];
      if (!link || next?.kind !== "days" || next.mask === "rest") break;
      if (link.kind === "range" && last !== undefined && next.single !== undefined) {
        let span = 0;
        for (let day = last; ; day = (day + 1) % 7) {
          span |= 1 << day;
          if (day === next.single) break;
        }
        mask = subtract ? mask & ~span : mask | span;
      } else if (
        link.kind === "list" ||
        link.kind === "or" ||
        (link.kind === "comma" && !afterTime)
      ) {
        mask = subtract ? mask & ~next.mask : mask | next.mask;
      } else if (link.kind === "except") {
        subtract = true;
        mask &= ~next.mask;
      } else break;
      last = next.single;
      i += 2;
    }
    result.push({ kind: "days", mask });
  }
  return result;
}

type Unit = { kind: "days"; mask: Mask } | { kind: "spec"; spec: Spec } | { kind: "off" };

function units(sentence: Item[]): Unit[] | null {
  const result: Unit[] = [];
  let pending: "wake" | "bed" | null = null;
  for (let i = 0; i < sentence.length; i++) {
    const item = sentence[i];
    if (item.kind === "days") result.push(item);
    else if (item.kind === "off") result.push({ kind: "off" });
    else if (item.kind === "wake" || item.kind === "bed") pending = item.kind;
    else if (item.kind === "time" || item.kind === "between") {
      const between = item.kind === "between";
      const first = sentence[between ? i + 1 : i],
        link = sentence[between ? i + 2 : i + 1],
        second = sentence[between ? i + 3 : i + 2];
      if (
        first?.kind === "time" &&
        second?.kind === "time" &&
        (between ? link?.kind === "list" : link?.kind === "range")
      ) {
        // "sleep 11 to 7" names bedtime first.
        const [wake, bed] =
          pending === "bed" ? [second.time, first.time] : [first.time, second.time];
        result.push({ kind: "spec", spec: { wake, bed, loose: [] } });
        i += between ? 3 : 2;
      } else if (between || first?.kind !== "time") return null;
      else if (pending) result.push({ kind: "spec", spec: { [pending]: first.time, loose: [] } });
      else result.push({ kind: "spec", spec: { loose: [first.time] } });
      pending = null;
    }
  }
  // A wake-up or bedtime word without a time, as in "weekends I sleep in".
  return pending ? null : result;
}

function clause(mask: Mask, parts: Unit[]): Clause | null {
  const off = parts.some((part) => part.kind === "off");
  const specs = parts.flatMap((part) => (part.kind === "spec" ? [part.spec] : []));
  if (off) return specs.length ? null : { mask, off };
  if (!specs.length) return null;
  let wake: Time | undefined, bed: Time | undefined;
  const loose: Time[] = [];
  for (const spec of specs) {
    if ((spec.wake && wake) || (spec.bed && bed)) return null;
    wake ??= spec.wake;
    bed ??= spec.bed;
    loose.push(...spec.loose);
  }
  if (loose.length === 2 && !wake && !bed) [wake, bed] = loose;
  else if (loose.length === 1 && !wake !== !bed) {
    if (wake) bed = loose[0];
    else wake = loose[0];
  } else if (loose.length) return null;
  return { mask, off, wake, bed };
}

function clauses(list: Item[]): Clause[] | null {
  const result: Clause[] = [];
  let inherited: Mask = ALL;
  const sentences: Item[][] = [[]];
  for (const item of list) {
    if (item.kind === "stop") sentences.push([]);
    else sentences.at(-1)!.push(item);
  }
  for (const sentence of sentences) {
    const parts = units(sentence);
    if (!parts) return null;
    if (!parts.length) continue;
    const groups: { mask: Mask; parts: Unit[] }[] = [];
    const dayCount = parts.filter((part) => part.kind === "days").length;
    if (dayCount <= 1) {
      // One set of days covers the whole sentence; none continues the previous sentence's days.
      const days = parts.find((part) => part.kind === "days");
      groups.push({ mask: days?.mask ?? inherited, parts });
    } else if (parts[0].kind === "days") {
      // "Weekdays 7-10, weekends 9-12": times follow their days.
      for (const part of parts) {
        if (part.kind === "days") groups.push({ mask: part.mask, parts: [] });
        else groups.at(-1)!.parts.push(part);
      }
    } else {
      // "7-10 weekdays, 9-12 weekends": times come before their days.
      let waiting: Unit[] = [];
      for (const part of parts) {
        if (part.kind !== "days") waiting.push(part);
        else {
          groups.push({ mask: part.mask, parts: waiting });
          waiting = [];
        }
      }
      if (waiting.length) {
        const last = groups.at(-1)!;
        if (last.parts.length) return null;
        last.parts = waiting;
      }
    }
    for (const group of groups) {
      const next = clause(group.mask, group.parts);
      if (!next) return null;
      result.push(next);
    }
    inherited = groups.at(-1)!.mask;
  }
  return result;
}

function candidates({ hour, minute, meridiem, fixed }: Time) {
  if (fixed) return [hour * 60 + minute];
  const base = (hour % 12) * 60 + minute;
  if (meridiem) return [meridiem === "pm" ? base + 720 : base];
  // Without am or pm, 12 reads as noon first and other hours as morning first.
  return hour === 12 ? [base + 720, base] : [base, base + 720];
}

export function parseRoutine(description: string, current: ReminderDay[], windDownMinutes: number) {
  const tokens = lex(description);
  const merged = tokens && items(tokens);
  const list = merged && mergeDays(merged);
  const parsed = list && clauses(list);
  if (!parsed?.length) return null;
  const named = parsed.reduce((mask, next) => (next.mask === "rest" ? mask : mask | next.mask), 0);
  const patches: { off: boolean; wake?: Time; bed?: Time }[] = [];
  for (const next of parsed) {
    const mask = next.mask === "rest" ? ALL & ~named : next.mask;
    for (let day = 0; day < 7; day++) {
      if (!(mask & (1 << day))) continue;
      const previous = patches[day];
      patches[day] = next.off
        ? { off: true }
        : {
            off: false,
            wake: next.wake ?? (previous?.off ? undefined : previous?.wake),
            bed: next.bed ?? (previous?.off ? undefined : previous?.bed),
          };
    }
  }
  let adjusted = false;
  const schedule = current.map((previous, day): ReminderDay => {
    const patch = patches[day];
    if (!patch) return previous;
    if (patch.off) return { wake: previous.wake, bed: previous.bed, off: true };
    const next = likeliestDay(
      patch.wake ? candidates(patch.wake) : [previous.wake],
      patch.bed ? candidates(patch.bed) : [previous.bed],
      windDownMinutes
    );
    if (next) return next;
    adjusted = true;
    return previous;
  });
  return { schedule, adjusted };
}
