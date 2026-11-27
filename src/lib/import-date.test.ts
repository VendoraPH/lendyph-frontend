// Every assertion below is about a calendar date, and this importer's whole job
// is to not move one by accident, so the zone cannot be left to whoever runs
// the suite. Pin it here, exactly as format.test.ts does.
//
// How: assigning `process.env.TZ` makes Node re-read the zone (it notifies V8,
// which drops its cached offset), and `node:test` runs each test file in its
// own process, so this cannot leak into a sibling suite. The first test asserts
// the pin actually took — without that guard this file would quietly pass on a
// UTC CI box while testing nothing at all. It is deliberately not left to the
// machine: every dev box on this team is already Asia/Manila, which is exactly
// how the original date bug survived two rounds of review.
process.env.TZ = "Asia/Manila";

import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  AMBIGUITY_SAMPLE_LIMIT,
  fromExcelSerial,
  inferDateFormat,
  isFutureDate,
  looksLikeDate,
  MAX_EXCEL_SERIAL,
  MIN_EXCEL_SERIAL,
  parseImportDate,
  type DateFormatInference,
} from "./import-date";

test("the suite is pinned to Manila (UTC+8), not the machine's zone", () => {
  assert.equal(
    new Date(Date.UTC(2026, 7, 6, 16, 30)).getTimezoneOffset(),
    -480,
    "TZ pin did not take effect — every assertion below would be vacuous",
  );
});

// ── The ambiguity matrix ───────────────────────────────────────────────────

/** Narrowing helper so the assertions below can read fields off the verdict. */
function expectStatus<S extends DateFormatInference["status"]>(
  result: DateFormatInference,
  status: S,
): Extract<DateFormatInference, { status: S }> {
  assert.equal(result.status, status);
  return result as Extract<DateFormatInference, { status: S }>;
}

test("a first component over 12 proves day-first for the whole column", () => {
  const result = expectStatus(
    inferDateFormat(["03/04/2020", "31/12/2019", "01/02/2021"]),
    "resolved",
  );
  assert.equal(result.order, "dmy");
  assert.equal(result.evidence, "31/12/2019");
});

test("a second component over 12 proves month-first for the whole column", () => {
  const result = expectStatus(
    inferDateFormat(["03/04/2020", "12/31/2019", "01/02/2021"]),
    "resolved",
  );
  assert.equal(result.order, "mdy");
  assert.equal(result.evidence, "12/31/2019");
});

test("proof of BOTH orders in one column is a conflict, not a majority vote", () => {
  const result = expectStatus(
    inferDateFormat(["31/12/2019", "12/31/2019", "03/04/2020"]),
    "conflicted",
  );
  assert.equal(result.dmyEvidence, "31/12/2019");
  assert.equal(result.mdyEvidence, "12/31/2019");
});

test("one row of the minority order still conflicts a 400-row column", () => {
  // The scenario the status exists for: a file assembled from two branches'
  // exports. There is no safe setting, so no setting is offered.
  const column = Array.from({ length: 400 }, () => "25/06/2020");
  column[250] = "06/25/2020";
  expectStatus(inferDateFormat(column), "conflicted");
});

test("YYYY-MM-DD is unambiguous and needs no decision at all", () => {
  const result = expectStatus(
    inferDateFormat(["2020-03-04", "2019-12-31", "2021-01-02"]),
    "resolved",
  );
  assert.equal(result.order, null);
  assert.equal(result.evidence, null);
  assert.equal(result.stats.iso, 3);
});

test("all components 12 or under is ambiguous — the UI must ask", () => {
  const result = expectStatus(
    inferDateFormat(["03/04/2020", "01/02/2021", "05/06/2019"]),
    "ambiguous",
  );
  assert.ok(result.samples.length > 0);
});

test("ambiguous samples render each value BOTH ways for the admin", () => {
  const result = expectStatus(inferDateFormat(["03/04/2020"]), "ambiguous");
  assert.deepEqual(result.samples, [
    { value: "03/04/2020", dmy: "2020-04-03", mdy: "2020-03-04" },
  ]);
});

test("samples lead with values that actually differ between the two readings", () => {
  // 05/05/2020 reads the same either way. Showing it as the example makes the
  // two options look identical and invites a coin flip.
  const result = expectStatus(
    inferDateFormat(["05/05/2020", "07/07/2019", "03/04/2020"]),
    "ambiguous",
  );
  assert.equal(result.samples[0].value, "03/04/2020");
  assert.notEqual(result.samples[0].dmy, result.samples[0].mdy);
});

test("sample list is capped and de-duplicated", () => {
  const column = ["01/02/2020", "01/02/2020", "03/04/2020", "05/06/2020",
    "07/08/2020", "09/10/2020", "11/12/2020", "02/01/2020"];
  const result = expectStatus(inferDateFormat(column), "ambiguous");
  assert.equal(result.samples.length, AMBIGUITY_SAMPLE_LIMIT);
  assert.equal(new Set(result.samples.map((s) => s.value)).size, AMBIGUITY_SAMPLE_LIMIT);
});

test("ISO values alongside ambiguous ones do not settle the ambiguous ones", () => {
  const result = expectStatus(
    inferDateFormat(["2020-03-04", "2020-05-06", "03/04/2020"]),
    "ambiguous",
  );
  assert.equal(result.stats.iso, 2);
  assert.equal(result.stats.pair, 1);
});

test("one proving row settles a column that is otherwise all ambiguous", () => {
  const column = Array.from({ length: 200 }, () => "03/04/2020");
  column[199] = "25/06/2020";
  const result = expectStatus(inferDateFormat(column), "resolved");
  assert.equal(result.order, "dmy");
});

test("a blank column is empty, not ambiguous", () => {
  const result = expectStatus(inferDateFormat(["", "   ", "\t"]), "empty");
  assert.equal(result.stats.blank, 3);
});

test("blanks are ignored as evidence but still counted", () => {
  const result = expectStatus(inferDateFormat(["", "31/12/2019", "  "]), "resolved");
  assert.equal(result.order, "dmy");
  assert.equal(result.stats.blank, 2);
});

test("a column of non-dates is unusable, and says which values it choked on", () => {
  const result = expectStatus(inferDateFormat(["N/A", "none", "TBA"]), "unusable");
  assert.equal(result.stats.unrecognised, 3);
  assert.deepEqual(result.stats.unrecognisedSamples, ["N/A", "none", "TBA"]);
});

// ── Impossible dates are not evidence ──────────────────────────────────────

test("30/02/2020 proves nothing — February has no 30th in either reading", () => {
  // The naive ">12 in the first component" rule would read this as proof of
  // day-first and let one bad row decide 400 good ones.
  const result = expectStatus(inferDateFormat(["30/02/2020", "03/04/2020"]), "ambiguous");
  assert.equal(result.stats.invalid, 1);
  assert.deepEqual(result.stats.invalidSamples, ["30/02/2020"]);
});

test("31/13/2020 does not fake a conflict by proving both orders at once", () => {
  const result = expectStatus(inferDateFormat(["31/13/2020", "03/04/2020"]), "ambiguous");
  assert.equal(result.stats.invalid, 1);
});

test("29 February proves day-first in a leap year", () => {
  const result = expectStatus(inferDateFormat(["29/02/2020"]), "resolved");
  assert.equal(result.order, "dmy");
});

test("29 February in a NON-leap year is impossible, not proof", () => {
  const result = expectStatus(inferDateFormat(["29/02/2019"]), "unusable");
  assert.equal(result.stats.invalid, 1);
});

test("any four-digit year reads, as the server reads it", () => {
  // The server has no year window (ValueNormalizer::date()): a year is four
  // digits, and the date must exist. Plausibility is each column's own rule.
  assert.deepEqual(parseImportDate("2999-01-01", null), { ok: true, iso: "2999-01-01", warning: null });
  assert.deepEqual(parseImportDate("0000-01-01", null), { ok: true, iso: "0000-01-01", warning: null });
  assert.deepEqual(parseImportDate("03/04/2205", "dmy"), { ok: true, iso: "2205-04-03", warning: null });
  // A chosen order reads a calendar date (PHP's checkdate()), which has no year 0.
  assert.deepEqual(parseImportDate("03/04/0000", "dmy"), {
    ok: false,
    reason: "impossible",
    message: '"03/04/0000" is not a real date read day-first, the order chosen for this column.',
  });
  expectStatus(inferDateFormat(["03/04/0201", "2999-01-01"]), "ambiguous");
});

// ── Excel serial numbers ───────────────────────────────────────────────────

test("a column of Excel serials resolves with no order to choose", () => {
  const result = expectStatus(inferDateFormat(["43831", "44000", "40000"]), "resolved");
  assert.equal(result.order, null);
  assert.equal(result.stats.serial, 3);
});

test("Excel serials count days from 1899-12-30", () => {
  assert.equal(fromExcelSerial(43831), "2020-01-01");
  assert.equal(fromExcelSerial(44000), "2020-06-18");
  assert.equal(fromExcelSerial(36526), "2000-01-01");
});

test("the serial window is the server's, closed at both ends", () => {
  assert.deepEqual([MIN_EXCEL_SERIAL, MAX_EXCEL_SERIAL], [20000, 60000]);
  assert.equal(looksLikeDate(String(MIN_EXCEL_SERIAL)), true);
  assert.equal(looksLikeDate(String(MAX_EXCEL_SERIAL)), true);
  assert.equal(looksLikeDate(String(MIN_EXCEL_SERIAL - 1)), false);
  assert.equal(looksLikeDate(String(MAX_EXCEL_SERIAL + 1)), false);
});

test("a bare integer outside the window is data, not a date", () => {
  // A bare year, and an integer past 2064. Note this is NOT what stops an
  // account number being read as a date — serial detection only ever runs on a
  // column already identified as a date column, so amounts and account numbers
  // never reach this path at all. That scoping is what lets the floor sit low
  // enough to cover an elderly member's birthdate.
  const result = expectStatus(inferDateFormat(["2020", "1500", "100234"]), "unusable");
  assert.equal(result.stats.serial, 0);
  assert.equal(result.stats.unrecognised, 3);
});

test("a serial below the server's window is not a date the import reads", () => {
  // ValueNormalizer::EXCEL_SERIAL_MIN is 20000 (3 October 1954): the server
  // refuses an earlier one, so the Check step says so before the upload.
  assert.equal(fromExcelSerial(MIN_EXCEL_SERIAL), "1954-10-03");
  assert.deepEqual(parseImportDate("17673", null), {
    ok: false,
    reason: "unrecognised",
    message: '"17673" is not a date this importer recognises. Use YYYY-MM-DD.',
  });
  expectStatus(inferDateFormat(["17673", "19301"]), "unusable");
});

test("serials mixed into a slash-dated column are counted, not confused", () => {
  const result = expectStatus(
    inferDateFormat(["31/12/2019", "43831", "03/04/2020"]),
    "resolved",
  );
  assert.equal(result.order, "dmy");
  assert.equal(result.stats.serial, 1);
  assert.equal(result.stats.pair, 2);
});

test("a serial parses the same whatever order the admin picked, with the server's warning", () => {
  for (const order of ["dmy", "mdy", null] as const) {
    assert.deepEqual(parseImportDate("43831", order), {
      ok: true,
      iso: "2020-01-01",
      warning: '"43831" is an Excel serial date number and will be read as 2020-01-01. Confirm it against the source workbook.',
    });
  }
});

// ── Two-digit years: refused, never guessed ────────────────────────────────

test("a two-digit year is refused rather than assigned a century", () => {
  // `03/04/55` is 1955 for a birthdate and 2055 for a maturity date, and this
  // module has no way to tell. A pivot window here would be a guess wearing a
  // rule's clothing, so the value is reported and the source file gets fixed.
  assert.deepEqual(parseImportDate("03/04/55", "dmy"), {
    ok: false,
    reason: "two-digit-year",
    message: '"03/04/55" is not a date this importer recognises. Use YYYY-MM-DD.',
  });
});

test("a column of two-digit years is unusable and quotes the offenders", () => {
  const result = expectStatus(inferDateFormat(["03/04/55", "12/11/78"]), "unusable");
  assert.equal(result.stats.shortYear, 2);
  assert.deepEqual(result.stats.shortYearSamples, ["03/04/55", "12/11/78"]);
});

// ── Parsing ────────────────────────────────────────────────────────────────

test("the same cell parses to different days under the two orders", () => {
  assert.deepEqual(parseImportDate("03/04/2020", "dmy"), { ok: true, iso: "2020-04-03", warning: null });
  assert.deepEqual(parseImportDate("03/04/2020", "mdy"), { ok: true, iso: "2020-03-04", warning: null });
});

test("with no order, a slash date reads month-first with the server's warning when it reads both ways", () => {
  // The server's reading for a column the Check step gave no order. A column
  // of day/month/year dates always has one, so this is the run that predates
  // date orders.
  assert.deepEqual(parseImportDate("03/04/2020", null), {
    ok: true,
    iso: "2020-03-04",
    warning: '"03/04/2020" could be read as 2020-03-04 (month first, which is what will be used) or as 2020-04-03 (day first). Check it against the source workbook.',
  });
  assert.deepEqual(parseImportDate("03/31/2020", null), { ok: true, iso: "2020-03-31", warning: null });
  // Day-first with no order is not a date the server reads.
  assert.equal(parseImportDate("31/03/2020", null).ok, false);
});

test("a cell that contradicts the chosen order FAILS instead of swapping itself", () => {
  // A quiet per-row swap is the same silent re-dating as a wrong column
  // verdict, only harder to spot afterwards.
  assert.deepEqual(parseImportDate("31/03/2020", "mdy"), {
    ok: false,
    reason: "impossible",
    message: '"31/03/2020" is not a real date read month-first, the order chosen for this column.',
  });
  assert.deepEqual(parseImportDate("03/31/2020", "dmy"), {
    ok: false,
    reason: "impossible",
    message: '"03/31/2020" is not a real date read day-first, the order chosen for this column.',
  });
});

test("an impossible date is rejected, NOT overflowed into the next month", () => {
  // `new Date(2020, 1, 31)` is 2 March. Importing that would post a maturity
  // date the borrower never agreed to, with nothing in the file to show for it.
  assert.equal(parseImportDate("31/02/2020", "dmy").ok, false);
  assert.equal(parseImportDate("02/31/2020", "mdy").ok, false);
  for (const cell of ["2020-02-31", "2019-02-29"]) {
    assert.deepEqual(parseImportDate(cell, null), {
      ok: false,
      reason: "impossible",
      message: `"${cell}" is not a date this importer recognises. Use YYYY-MM-DD.`,
    });
  }
});

test("ISO parses identically under either order", () => {
  for (const order of ["dmy", "mdy", null] as const) {
    assert.deepEqual(parseImportDate("2020-03-04", order), { ok: true, iso: "2020-03-04", warning: null });
  }
});

test("blank and junk cells are told apart", () => {
  const blank = parseImportDate("   ", "dmy");
  assert.equal(blank.ok ? null : blank.reason, "blank");
  assert.deepEqual(parseImportDate("N/A", "dmy"), {
    ok: false,
    reason: "unrecognised",
    message: '"N/A" is not a date this importer recognises. Use YYYY-MM-DD.',
  });
});

test("with an order, a day/month/year cell reads with any of the Check step's separators", () => {
  assert.deepEqual(parseImportDate("3/4/2020", "dmy"), { ok: true, iso: "2020-04-03", warning: null });
  assert.deepEqual(parseImportDate("03-04-2020", "dmy"), { ok: true, iso: "2020-04-03", warning: null });
  assert.deepEqual(parseImportDate("03.04.2020", "dmy"), { ok: true, iso: "2020-04-03", warning: null });
  assert.deepEqual(parseImportDate("2020/03/04", null), { ok: true, iso: "2020-03-04", warning: null });
});

test("a cell the server doesn't read isn't read here: an unpadded or dotted ISO date, or a time", () => {
  for (const cell of ["2025-3-4", "2025/3/4", "2025.03.04", "03/04/2025 00:00:00", "2025-03-04T00:00:00", "2025-03-04 00:00", "10000-01-01"]) {
    for (const order of ["dmy", "mdy", null] as const) {
      const parsed = parseImportDate(cell, order);
      assert.equal(parsed.ok ? parsed.iso : parsed.message, `"${cell}" is not a date this importer recognises. Use YYYY-MM-DD.`, `${cell} ${order}`);
    }
  }
});

// ── The timezone trap itself ───────────────────────────────────────────────

test("parsed dates keep their calendar day where toISOString would lose one", () => {
  // The banned expression is reproduced verbatim: this is the rule's own smoke
  // test. Both Dates below are local midnight in Manila, which is 16:00 the
  // PREVIOUS day in UTC — so the naive serialisation moves every imported date
  // back one, at every hour of the day, not just before 08:00.
  for (const [cell, expected] of [["31/12/2019", "2019-12-31"], ["43831", "2020-01-01"]] as const) {
    const parsed = parseImportDate(cell, "dmy");
    assert.equal(parsed.ok && parsed.iso, expected);

    const [y, m, d] = expected.split("-").map(Number);
    // eslint-disable-next-line no-restricted-syntax -- documents the old bug
    const broken = new Date(y, m - 1, d).toISOString().slice(0, 10);
    assert.notEqual(broken, expected, "the bug this module is built to avoid");
  }
});

test("inference is unaffected by the hour the admin runs the import", () => {
  // 00:30 Manila — the window in which the old code reported yesterday.
  mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 7, 6, 16, 30) });
  try {
    const result = expectStatus(inferDateFormat(["31/12/2019", "43831"]), "resolved");
    assert.equal(result.order, "dmy");
    const parsed = parseImportDate("43831", "dmy");
    assert.equal(parsed.ok && parsed.iso, "2020-01-01");
  } finally {
    mock.timers.reset();
  }
});

test("isFutureDate answers on the local calendar, not the UTC one", () => {
  mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 7, 6, 16, 30) /* 00:30 on the 7th */ });
  try {
    // A UTC reading of "today" would be the 6th, making the 7th look future —
    // and every date released today would be flagged as an error.
    assert.equal(isFutureDate("2026-08-07"), false);
    assert.equal(isFutureDate("2026-08-06"), false);
    assert.equal(isFutureDate("2026-08-08"), true);
  } finally {
    mock.timers.reset();
  }
});

// ── looksLikeDate (used by wrong-slot detection) ───────────────────────────

test("looksLikeDate accepts the server's shapes and nothing else", () => {
  assert.equal(looksLikeDate("2020-03-04"), true);
  assert.equal(looksLikeDate("03/04/2020"), true);
  assert.equal(looksLikeDate("43831"), true);
  assert.equal(looksLikeDate("4 Mar 1990"), true);
  assert.equal(looksLikeDate("2020-3-4"), false);
  assert.equal(looksLikeDate("Dela Cruz"), false);
  assert.equal(looksLikeDate("12"), false);
  assert.equal(looksLikeDate(""), false);
  assert.equal(looksLikeDate("31/02/2020"), false);
});

// ── The server's reading, written out (ValueNormalizer::date()) ────────────

/**
 * How the server reads a date cell (lendyph-backend,
 * app/Services/CsvImport/ValueNormalizer.php), after a trim:
 *  1. With the column's order (`dmy` or `mdy`): a day and month then a
 *     four-digit year, split by "/", "-" or ".", read in that order, and the
 *     date must exist (PHP checkdate(), no year 0). No warning.
 *  2. Otherwise the formats, in order, each read back exactly as written:
 *     `Y-m-d`, `Y/m/d`, `m/d/Y`, `n/j/Y`, `d-M-Y`, `j M Y`, `M j, Y`. A
 *     month-first slash date that also reads day-first warns that it reads
 *     two ways.
 *  3. Otherwise a whole number from 20000 to 60000 is an Excel serial date,
 *     read with a warning.
 *  4. Anything else is refused.
 * Each row: the cell, then what it reads as with no order, day-first and
 * month-first (`null` when refused), from the server's own output.
 */
const SERVER_READS: ReadonlyArray<readonly [string, string | null, string | null, string | null]> = [
  ["2025-03-04", "2025-03-04", "2025-03-04", "2025-03-04"],
  ["2025-3-4", null, null, null],
  ["2025/03/04", "2025-03-04", "2025-03-04", "2025-03-04"],
  ["2025/3/4", null, null, null],
  ["2025.03.04", null, null, null],
  ["0000-01-01", "0000-01-01", "0000-01-01", "0000-01-01"],
  ["0999-12-31", "0999-12-31", "0999-12-31", "0999-12-31"],
  ["9999-12-31", "9999-12-31", "9999-12-31", "9999-12-31"],
  ["10000-01-01", null, null, null],
  ["2025-02-29", null, null, null],
  ["2024-02-29", "2024-02-29", "2024-02-29", "2024-02-29"],
  ["03/04/2025", "2025-03-04", "2025-04-03", "2025-03-04"],
  ["3/4/2025", "2025-03-04", "2025-04-03", "2025-03-04"],
  ["03/4/2025", null, "2025-04-03", "2025-03-04"],
  ["3/04/2025", null, "2025-04-03", "2025-03-04"],
  ["03-04-2025", null, "2025-04-03", "2025-03-04"],
  ["03.04.2025", null, "2025-04-03", "2025-03-04"],
  ["13/04/2025", null, "2025-04-13", null],
  ["03/13/2025", "2025-03-13", null, "2025-03-13"],
  ["03/04/0000", "0000-03-04", null, null],
  ["03/04/0001", "0001-03-04", "0001-04-03", "0001-03-04"],
  ["03/04/2205", "2205-03-04", "2205-04-03", "2205-03-04"],
  ["03/04/25", null, null, null],
  ["12/25/2025", "2025-12-25", null, "2025-12-25"],
  ["1/15/2025", "2025-01-15", null, "2025-01-15"],
  ["04-Mar-1990", "1990-03-04", "1990-03-04", "1990-03-04"],
  ["4-Mar-1990", null, null, null],
  ["04-mar-1990", null, null, null],
  ["4 Mar 1990", "1990-03-04", "1990-03-04", "1990-03-04"],
  ["04 Mar 1990", null, null, null],
  ["Mar 4, 1990", "1990-03-04", "1990-03-04", "1990-03-04"],
  ["Mar 04, 1990", null, null, null],
  ["March 4, 1990", null, null, null],
  ["31-Feb-1990", null, null, null],
  ["Sep 4, 1990", "1990-09-04", "1990-09-04", "1990-09-04"],
  ["Sept 4, 1990", null, null, null],
  ["03/04/2025 00:00:00", null, null, null],
  ["19999", null, null, null],
  ["20000", "1954-10-03", "1954-10-03", "1954-10-03"],
  ["32874", "1990-01-01", "1990-01-01", "1990-01-01"],
  ["60000", "2064-04-08", "2064-04-08", "2064-04-08"],
  ["60001", null, null, null],
  ["3654", null, null, null],
  ["2025-03-04 ", "2025-03-04", "2025-03-04", "2025-03-04"],
  ["45000.0", null, null, null],
];

test("every cell reads as the server reads it, under no order, day-first and month-first", () => {
  for (const [cell, none, dmy, mdy] of SERVER_READS) {
    for (const [order, expected] of [[null, none], ["dmy", dmy], ["mdy", mdy]] as const) {
      const parsed = parseImportDate(cell, order);
      assert.equal(parsed.ok ? parsed.iso : null, expected, `${JSON.stringify(cell)} ${order ?? "no order"}`);
    }
  }
});

test("only a month-first slash date that also reads day-first, and a serial, warn", () => {
  const warned = (cell: string, order: "dmy" | "mdy" | null) => {
    const parsed = parseImportDate(cell, order);
    return parsed.ok ? parsed.warning !== null : null;
  };
  assert.equal(warned("03/04/2025", null), true);
  assert.equal(warned("3/4/2025", null), true);
  assert.equal(warned("03/04/2025", "mdy"), false, "a chosen order decides it");
  assert.equal(warned("03/04/2025", "dmy"), false);
  assert.equal(warned("03/13/2025", null), false, "reads only month-first");
  assert.equal(warned("05/05/2025", null), false, "the same day either way");
  assert.equal(warned("32874", "dmy"), true);
  assert.equal(warned("4 Mar 1990", null), false);
});
