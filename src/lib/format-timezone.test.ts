// Round fz: dates read in Philippine time on any computer. Each test below runs
// the formatters on a computer set west of Manila (New York) and one east of it
// (Auckland), and expects what a Manila computer shows. Assigning
// `process.env.TZ` makes Node re-read the zone, and `node:test` runs each file
// in its own process, so the switch can't leak into another suite.
import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  formatDate,
  formatDateFull,
  formatDateISO,
  formatDateLong,
  formatDateObj,
  formatDateTime,
  formatTime,
  calendarDate,
  clockDate,
  daysFromToday,
  todayDate,
  todayISO,
} from "./format";

const ELSEWHERE = ["America/New_York", "Pacific/Auckland"];

function onEveryComputer(check: () => void) {
  const original = process.env.TZ;
  try {
    for (const zone of [...ELSEWHERE, "Asia/Manila"]) {
      process.env.TZ = zone;
      check();
    }
  } finally {
    process.env.TZ = original;
  }
}

/** 20:00 on 9 Nov 2026 in Manila: 07:00 the 9th in New York, 01:00 the 10th in Auckland. */
const EVENING_MANILA = "2026-11-09T12:00:00Z";
/** 04:00 on 10 Nov 2026 in Manila: 15:00 the 9th in New York. */
const EARLY_MANILA = "2026-11-09T20:00:00.000000Z";

test("the zone switch takes effect, so the checks below aren't vacuous", () => {
  const offsets: number[] = [];
  onEveryComputer(() => offsets.push(new Date(EVENING_MANILA).getTimezoneOffset()));
  assert.deepEqual(offsets, [300, -780, -480]);
});

test("a date-only value shows that same calendar date", () => {
  onEveryComputer(() => {
    assert.equal(formatDate("2026-08-30"), "Aug 30, 2026");
    assert.equal(formatDate("2026-01-01"), "Jan 1, 2026");
    assert.equal(formatDateLong("2026-08-30"), "August 30, 2026");
    assert.equal(formatDateFull("2026-08-30"), "Sunday, August 30, 2026");
  });
});

test("a UTC timestamp shows Manila's date", () => {
  onEveryComputer(() => {
    assert.equal(formatDate(EVENING_MANILA), "Nov 9, 2026");
    assert.equal(formatDate(EARLY_MANILA), "Nov 10, 2026");
    assert.equal(formatDateLong(EARLY_MANILA), "November 10, 2026");
    assert.equal(formatDateFull(new Date(EARLY_MANILA)), "Tuesday, November 10, 2026");
  });
});

test("a UTC timestamp shows Manila's date and time", () => {
  onEveryComputer(() => {
    assert.equal(formatDateTime(EVENING_MANILA), "Nov 9, 2026, 08:00 PM");
    assert.equal(formatDateTime(EARLY_MANILA), "Nov 10, 2026, 04:00 AM");
    assert.equal(formatTime(EVENING_MANILA), "8:00 PM");
    assert.equal(formatTime(new Date(EARLY_MANILA)), "4:00 AM");
  });
});

test("a server time with no zone is Manila time", () => {
  onEveryComputer(() => {
    assert.equal(formatDateTime("2026-11-09 14:05:00"), "Nov 9, 2026, 02:05 PM");
    assert.equal(formatDateTime("2026-11-09T23:30"), "Nov 9, 2026, 11:30 PM");
    assert.equal(formatTime("2026-11-09 00:15:00"), "12:15 AM");
  });
});

test("a picked calendar date (a Date at the computer's own midnight) keeps its day", () => {
  onEveryComputer(() => {
    assert.equal(formatDateObj(new Date(2026, 7, 30)), "Aug 30, 2026");
    assert.equal(formatDateObj(new Date(2026, 0, 1)), "Jan 1, 2026");
  });
});

/** Run `check` with the clock stopped at `instant`. */
function at(instant: number, check: () => void) {
  mock.timers.enable({ apis: ["Date"], now: instant });
  try {
    check();
  } finally {
    mock.timers.reset();
  }
}

test("today is Manila's date, on a computer west or east of it", () => {
  // 19:30 on 9 Nov in Manila: 06:30 the 9th in New York, 00:30 the 10th in Auckland.
  at(Date.UTC(2026, 10, 9, 11, 30), () => {
    onEveryComputer(() => assert.equal(todayISO(), "2026-11-09"));
  });
  // 04:00 on 10 Nov in Manila: 15:00 the 9th in New York, 09:00 the 10th in Auckland.
  at(Date.UTC(2026, 10, 9, 20, 0), () => {
    onEveryComputer(() => assert.equal(todayISO(), "2026-11-10"));
  });
});

test("a date picker's default is Manila's today, held at the computer's own midnight", () => {
  at(Date.UTC(2026, 10, 9, 11, 30), () => {
    onEveryComputer(() => {
      const picked = todayDate();
      assert.equal(formatDateISO(picked), "2026-11-09");
      assert.equal(formatDateObj(picked), "Nov 9, 2026");
      assert.deepEqual([picked.getHours(), picked.getMinutes()], [0, 0]);
    });
  });
});

// Source check: every date or time a screen shows goes through `src/lib/format.ts`
// or names its zone. A bare `toLocaleDateString` / `toLocaleTimeString` reads
// the computer's zone.
const SCANNED = ["src/app", "src/components"];

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Each `toLocaleDateString(…)` / `toLocaleTimeString(…)` call whose arguments name no `timeZone`. */
function zonelessCalls(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/\.toLocale(?:Date|Time)String\(/g)) {
    let depth = 1;
    let end = match.index + match[0].length;
    while (end < source.length && depth > 0) {
      if (source[end] === "(") depth += 1;
      if (source[end] === ")") depth -= 1;
      end += 1;
    }
    const call = source.slice(match.index, end);
    if (!/\btimeZone\b/.test(call)) found.push(call.replace(/\s+/g, " "));
  }
  return found;
}

test("the source check fires on a call without a zone, and passes one that names it", () => {
  assert.equal(zonelessCalls('new Date(s).toLocaleDateString("en-US", { month: "short" })').length, 1);
  assert.equal(zonelessCalls("d.toLocaleTimeString()").length, 1);
  assert.equal(zonelessCalls('d.toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })').length, 0);
  assert.equal(zonelessCalls("formatDate(s)").length, 0);
});

test("no screen formats a date or time in the computer's zone", () => {
  const offenders = SCANNED.flatMap(sources).flatMap((file) =>
    zonelessCalls(readFileSync(file, "utf8")).map((call) => `${file}: ${call}`),
  );
  assert.deepEqual(offenders, []);
});

/**
 * The other ways a screen can read the computer's zone (round 2):
 * - an `Intl.DateTimeFormat` that names no `timeZone`;
 * - date-fns `format`, which reads a `Date`'s local parts (the format.ts
 *   helpers say which reading they mean);
 * - a date-fns range built from the computer's `new Date()`, which is the
 *   wrong day for part of every day west or east of Manila (`todayDate()` is
 *   Manila's today).
 */
function otherZonelessUses(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/new Intl\.DateTimeFormat\(/g)) {
    let depth = 1;
    let end = match.index + match[0].length;
    while (end < source.length && depth > 0) {
      if (source[end] === "(") depth += 1;
      if (source[end] === ")") depth -= 1;
      end += 1;
    }
    const call = source.slice(match.index, end);
    if (!/\btimeZone\b/.test(call)) found.push(call.replace(/\s+/g, " "));
  }
  for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']date-fns["']/g)) {
    if (/(^|[\s,])format([\s,]|$)/.test(match[1])) found.push("date-fns format");
  }
  for (const match of source.matchAll(/\b(?:startOf|endOf|sub|add)[A-Z]\w*\(\s*new Date\(\)/g)) {
    found.push(match[0]);
  }
  return found;
}

test("the wider source check fires on each zoneless form, and passes the zoned ones", () => {
  assert.equal(otherZonelessUses('new Intl.DateTimeFormat("en-PH", { month: "short" })').length, 1);
  assert.equal(otherZonelessUses('new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" })').length, 0);
  assert.equal(otherZonelessUses('import { format, startOfMonth } from "date-fns";').length, 1);
  assert.equal(otherZonelessUses('import { formatDistanceToNow } from "date-fns";').length, 0);
  assert.equal(otherZonelessUses("startOfMonth(new Date())").length, 1);
  assert.equal(otherZonelessUses("startOfMonth(todayDate())").length, 0);
});

test("no screen formats with a zoneless Intl or date-fns format, or counts from the computer's today", () => {
  const offenders = SCANNED.flatMap(sources).flatMap((file) =>
    otherZonelessUses(readFileSync(file, "utf8")).map((use) => `${file}: ${use}`),
  );
  assert.deepEqual(offenders, []);
});

test("a server time reads as Manila's clock, held at the computer's own clock", () => {
  onEveryComputer(() => {
    for (const [value, reading] of [
      ["2026-11-09", "2026-11-09 00:00"],
      ["2026-11-09 23:30:00", "2026-11-09 23:30"],
      ["2026-11-09T12:00:00Z", "2026-11-09 20:00"],
      ["2026-11-09T20:00:00.000000Z", "2026-11-10 04:00"],
      ["2026-11-10T04:00:00+08:00", "2026-11-10 04:00"],
    ]) {
      const held = clockDate(value);
      const hh = String(held.getHours()).padStart(2, "0");
      const mm = String(held.getMinutes()).padStart(2, "0");
      assert.equal(`${formatDateISO(held)} ${hh}:${mm}`, reading, value);
    }
    assert.ok(Number.isNaN(clockDate("not a date").getTime()));
  });
});

test("days from today count Manila's calendar days, on any computer", () => {
  // 07:00 on 10 Nov in Manila: 18:00 the 9th in New York, 12:00 the 10th in Auckland.
  at(Date.UTC(2026, 10, 9, 23, 0), () => {
    onEveryComputer(() => {
      assert.equal(daysFromToday("2026-11-10"), 0);
      assert.equal(daysFromToday("2026-11-13"), 3);
      assert.equal(daysFromToday("2026-11-14"), 4);
      assert.equal(daysFromToday("2026-11-09"), -1);
      assert.equal(daysFromToday("2026-10-11"), -30);
      // 04:00 on 10 Nov in Manila.
      assert.equal(daysFromToday("2026-11-09T20:00:00Z"), 0);
      assert.ok(Number.isNaN(daysFromToday("not a date")));
    });
  });
  // Across New York's clock change (1 Nov 2026), a day is still a day.
  at(Date.UTC(2026, 10, 2, 4, 0), () => {
    onEveryComputer(() => assert.equal(daysFromToday("2026-10-30"), -3));
  });
});

test("a server date becomes Manila's calendar day, held as a picker holds it", () => {
  onEveryComputer(() => {
    for (const [value, day] of [
      ["2026-11-09", "2026-11-09"],
      ["2026-08-09T00:00:00.000000Z", "2026-08-09"],
      ["2026-11-09T20:00:00Z", "2026-11-10"],
      ["2026-11-09 23:30:00", "2026-11-09"],
    ]) {
      const held = calendarDate(value);
      assert.equal(formatDateISO(held), day, value);
      assert.deepEqual([held.getHours(), held.getMinutes()], [0, 0]);
    }
    assert.ok(Number.isNaN(calendarDate("not a date").getTime()));
  });
});
