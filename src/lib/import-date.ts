/**
 * Date-format inference for the data-migration CSV import.
 *
 * The client's workbook declares NO date format. Both sheets ship header-only:
 * no number formats on any cell, no sample rows, nothing to read a convention
 * off. Three columns are dates (Birthdate, Date Released, Maturity Date) and
 * `03/04/2020` is 3 April or 4 March with equal claim. Guess wrong and an
 * entire cooperative's loan book is silently re-dated — maturity dates, ageing
 * buckets, penalty accrual and every "as of" report move together, and nothing
 * in the resulting data looks broken.
 *
 * So nothing in this module guesses. Every function either PROVES an answer
 * from the column's own contents or reports that it cannot, and the UI asks the
 * admin. `inferDateFormat` looks at a whole column at once — one row is rarely
 * decisive, a column of four hundred usually is.
 *
 * Timezone: the app runs on Philippine Standard Time (UTC+8), where
 * `toISOString()` reports YESTERDAY between 00:00 and 07:59. Every calendar
 * date produced here goes through `formatDateISO`, which reads LOCAL Y/M/D.
 * An ESLint rule makes the broken pattern a build error, but the rule is the
 * backstop, not the reason: a date that is wrong by one day in an import of
 * ten thousand rows is not something anyone will notice until a borrower
 * disputes their maturity date.
 */

import { formatDateISO, todayISO } from "./format";

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

/**
 * Excel's 1900 date system counts days from 1899-12-30, so serial 1 is
 * 1900-01-01. A CSV exported from the client's workbook turns any cell Excel
 * considered a real date into one of these integers.
 */
const EXCEL_EPOCH = { year: 1899, month: 11, day: 30 } as const;

/**
 * The serial window the server reads (`ValueNormalizer::EXCEL_SERIAL_MIN` and
 * `MAX`): 20000 (3 October 1954) to 60000 (8 April 2064). The server refuses a
 * number outside it, so the Check step does too (finish run round 4).
 */
export const MIN_EXCEL_SERIAL = 20000;
export const MAX_EXCEL_SERIAL = 60000;

/** How many worked examples the ambiguity prompt shows the admin. */
export const AMBIGUITY_SAMPLE_LIMIT = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Which way round an ambiguous `03/04/2020` should be read. */
export type DateOrder = "dmy" | "mdy";

/**
 * What a single cell turned out to be.
 *
 * `invalid` and `unrecognised` are kept apart on purpose: "13/45/2020 is not a
 * real date" and "N/A is not a date at all" send the admin to different fixes.
 */
export type DateShape =
  | "blank"
  | "iso"
  | "named"
  | "pair"
  | "serial"
  | "short-year"
  | "invalid"
  | "unrecognised";

/** Per-shape tallies for the whole column, so the UI can show its working. */
export interface DateColumnStats {
  total: number;
  blank: number;
  iso: number;
  /** Written with the month's name: `04-Mar-1990`, `4 Mar 1990`, `Mar 4, 1990`. */
  named: number;
  pair: number;
  serial: number;
  shortYear: number;
  invalid: number;
  unrecognised: number;
  /** Distinct examples, capped, for the UI to quote back. */
  shortYearSamples: string[];
  invalidSamples: string[];
  unrecognisedSamples: string[];
}

/** One ambiguous value rendered both ways, for the admin to choose between. */
export interface AmbiguityPreview {
  /** The cell as it appears in the file, e.g. `03/04/2020`. */
  value: string;
  /** Read day-first: `2020-04-03`. */
  dmy: string;
  /** Read month-first: `2020-03-04`. */
  mdy: string;
}

export type DateFormatInference =
  /** Every cell was blank — there is nothing to infer from, and nothing to import. */
  | { status: "empty"; stats: DateColumnStats }
  /**
   * The column settled itself. `order` is the reading to parse with; it is
   * `null` when the column is entirely ISO and/or Excel serials, which carry
   * their own meaning and need no decision at all.
   */
  | {
      status: "resolved";
      order: DateOrder | null;
      /** The cell that proved it, e.g. `31/12/2019`. `null` when order is null. */
      evidence: string | null;
      stats: DateColumnStats;
    }
  /** Every slash date reads both ways. The UI must ask; see `samples`. */
  | { status: "ambiguous"; samples: AmbiguityPreview[]; stats: DateColumnStats }
  /**
   * The column contains proof of BOTH orders, so it was not written to one
   * convention. Unusable at any setting — block it and send the file back.
   */
  | {
      status: "conflicted";
      dmyEvidence: string;
      mdyEvidence: string;
      stats: DateColumnStats;
    }
  /** Non-blank values, but no usable date among them. See `stats` for why. */
  | { status: "unusable"; stats: DateColumnStats };

export type DateParseFailure =
  | "blank"
  /** Date-shaped, but not a date that exists. */
  | "impossible"
  /** `03/04/55` — the century is not knowable, and we will not invent one. */
  | "two-digit-year"
  /** Not a date in any shape the server reads. */
  | "unrecognised";

/**
 * A cell read as the server reads it (`ValueNormalizer::date()`), with the
 * server's words: the date and any warning it gives, or why it refuses it.
 */
export type ParsedImportDate =
  | { ok: true; iso: string; warning: string | null }
  | { ok: false; reason: DateParseFailure; message: string };

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** The server's `Y-m-d` and `Y/m/d`: a four-digit year, a two-digit month and day. */
const ISO_SHAPE = /^(\d{4})([-/])(\d{2})\2(\d{2})$/;
/**
 * A day and month then a four-digit year, split by "/", "-" or ".": what the
 * server reads in the column's chosen order.
 */
const PAIR_SHAPE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;
/** With no order, the server's `m/d/Y` (both padded) and `n/j/Y` (neither). */
const PADDED_SLASH = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const BARE_SLASH = /^([1-9]\d?)\/([1-9]\d?)\/(\d{4})$/;
const SHORT_YEAR_SHAPE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/;
const INTEGER_SHAPE = /^\d+$/;

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH = `(${MONTH_NAMES.join("|")})`;
/** The server's `d-M-Y`, `j M Y` and `M j, Y`, exactly as PHP writes them back. */
const NAMED_SHAPES: ReadonlyArray<{ shape: RegExp; day: number; month: number; year: number }> = [
  { shape: new RegExp(`^(\\d{2})-${MONTH}-(\\d{4})$`), day: 1, month: 2, year: 3 },
  { shape: new RegExp(`^([1-9]\\d?) ${MONTH} (\\d{4})$`), day: 1, month: 2, year: 3 },
  { shape: new RegExp(`^${MONTH} ([1-9]\\d?), (\\d{4})$`), day: 2, month: 1, year: 3 },
];

type Classified =
  | { shape: Exclude<DateShape, "pair" | "iso" | "named" | "serial">; value: string }
  | { shape: "iso" | "named"; value: string; year: number; month: number; day: number }
  | { shape: "serial"; value: string; serial: number }
  | {
      shape: "pair";
      value: string;
      first: number;
      second: number;
      year: number;
      /** The date exists when read day-first. */
      dmy: boolean;
      /** The date exists when read month-first. */
      mdy: boolean;
    };

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/**
 * Does this Y/M/D name a day that exists? Arithmetic, never `new Date`, which
 * reads years 0 to 99 as 1900 to 1999. `minYear` is 0 for a date read back
 * through PHP's formats and 1 for PHP's `checkdate()`, which the server uses
 * for a date read in a chosen order.
 */
function isRealDate(year: number, month: number, day: number, minYear = 0): boolean {
  if (year < minYear || month < 1 || month > 12 || day < 1) return false;
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= days;
}

/** `YYYY-MM-DD` from calendar parts, as text: any year, never through `Date`. */
function toISO(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** A cell as the server's `ValueNormalizer::text()` leaves it. */
function cellText(raw: string): string {
  return String(raw ?? "").replace(/\uFEFF/g, "").replace(/\u00A0/g, " ").trim();
}

/** A month-name date the server reads, as its parts, or null. */
function namedParts(value: string): { year: number; month: number; day: number } | null {
  for (const { shape, day, month, year } of NAMED_SHAPES) {
    const parts = shape.exec(value);
    if (parts) {
      return { year: Number(parts[year]), month: MONTH_NAMES.indexOf(parts[month]) + 1, day: Number(parts[day]) };
    }
  }
  return null;
}

function classify(raw: string): Classified {
  const value = cellText(raw);
  if (!value) return { shape: "blank", value: "" };

  const iso = ISO_SHAPE.exec(value);
  if (iso) {
    const [year, month, day] = [Number(iso[1]), Number(iso[3]), Number(iso[4])];
    return isRealDate(year, month, day)
      ? { shape: "iso", value, year, month, day }
      : { shape: "invalid", value };
  }

  const pair = PAIR_SHAPE.exec(value);
  if (pair) {
    const first = Number(pair[1]);
    const second = Number(pair[2]);
    const year = Number(pair[3]);
    // In a chosen order the server reads with `checkdate()`: no year 0.
    const dmy = isRealDate(year, second, first, 1);
    const mdy = isRealDate(year, first, second, 1);
    // Valid under neither reading (`31/13/2020`, `30/02/2020`) is an impossible
    // date, not evidence of an order. Treating it as evidence is how one bad
    // row would decide a whole column, or fake a conflict that is not there.
    if (!dmy && !mdy) return { shape: "invalid", value };
    return { shape: "pair", value, first, second, year, dmy, mdy };
  }

  const named = namedParts(value);
  if (named) {
    return isRealDate(named.year, named.month, named.day)
      ? { shape: "named", value, ...named }
      : { shape: "invalid", value };
  }

  if (SHORT_YEAR_SHAPE.test(value)) return { shape: "short-year", value };

  if (INTEGER_SHAPE.test(value)) {
    const serial = Number(value);
    if (serial >= MIN_EXCEL_SERIAL && serial <= MAX_EXCEL_SERIAL) {
      return { shape: "serial", value, serial };
    }
    // A bare integer outside the window is an account number or an amount.
    return { shape: "unrecognised", value };
  }

  return { shape: "unrecognised", value };
}

/** True for anything this module could turn into a date. Used by wrong-slot detection. */
export function looksLikeDate(value: string): boolean {
  const shape = classify(value).shape;
  return shape === "iso" || shape === "named" || shape === "pair" || shape === "serial";
}

// ---------------------------------------------------------------------------
// Column inference
// ---------------------------------------------------------------------------

const SAMPLE_CAP = 3;

function pushSample(into: string[], value: string): void {
  if (into.length < SAMPLE_CAP && !into.includes(value)) into.push(value);
}

/**
 * Read a whole column and report what — if anything — it proves about its own
 * date format.
 *
 * The rules, in the order they are applied:
 *  - a value valid under exactly ONE reading proves that reading.
 *
 *    This looks like an overcomplicated way to write "is a component > 12?",
 *    and it is deliberately not that. The >12 test is a SUBSET of this one — a
 *    first component over 12 makes the month-first reading impossible, which is
 *    precisely *why* it proves day-first — but stated as a component test it
 *    gets two cases wrong, both of which we will see in a real file:
 *
 *      `30/02/2020`  >12 in the first component, so the naive rule calls it
 *                    proof of day-first. February has no 30th; it is proof of
 *                    nothing, and one typo would decide how 400 good rows are
 *                    read. Here it is `invalid`, quoted back, and abstains.
 *
 *      `31/13/2020`  >12 in BOTH components, so the naive rule finds proof of
 *                    day-first AND month-first in a single cell and declares
 *                    the column conflicted — blocking an import that was
 *                    perfectly fine apart from one unusable cell.
 *
 *    Validity subsumes the component test and is wrong in neither case, so it
 *    is the rule. Do not "simplify" it back.
 *  - proof of both readings in one column means it was not written to one
 *    convention. Conflicted; block it.
 *  - values valid under both readings prove nothing. If that is all there is,
 *    the column is ambiguous and only the admin can settle it.
 *  - ISO, month-name dates and Excel serials carry their own meaning, so a
 *    column made only of those is resolved with no order to choose.
 */
export function inferDateFormat(values: readonly string[]): DateFormatInference {
  const stats: DateColumnStats = {
    total: values.length,
    blank: 0,
    iso: 0,
    named: 0,
    pair: 0,
    serial: 0,
    shortYear: 0,
    invalid: 0,
    unrecognised: 0,
    shortYearSamples: [],
    invalidSamples: [],
    unrecognisedSamples: [],
  };

  let dmyEvidence: string | null = null;
  let mdyEvidence: string | null = null;
  const ambiguous: Classified[] = [];

  for (const raw of values) {
    const cell = classify(raw);
    switch (cell.shape) {
      case "blank":
        stats.blank += 1;
        break;
      case "iso":
        stats.iso += 1;
        break;
      case "named":
        stats.named += 1;
        break;
      case "serial":
        stats.serial += 1;
        break;
      case "short-year":
        stats.shortYear += 1;
        pushSample(stats.shortYearSamples, cell.value);
        break;
      case "invalid":
        stats.invalid += 1;
        pushSample(stats.invalidSamples, cell.value);
        break;
      case "unrecognised":
        stats.unrecognised += 1;
        pushSample(stats.unrecognisedSamples, cell.value);
        break;
      case "pair":
        stats.pair += 1;
        if (cell.dmy && cell.mdy) ambiguous.push(cell);
        else if (cell.dmy) dmyEvidence ??= cell.value;
        else mdyEvidence ??= cell.value;
        break;
    }
  }

  if (stats.blank === stats.total) return { status: "empty", stats };

  // Checked before either single-order verdict: a column holding proof of both
  // is unusable at EITHER setting, and offering the admin a choice would just
  // let them pick which half of the file to corrupt.
  if (dmyEvidence && mdyEvidence) {
    return { status: "conflicted", dmyEvidence, mdyEvidence, stats };
  }
  if (dmyEvidence) {
    return { status: "resolved", order: "dmy", evidence: dmyEvidence, stats };
  }
  if (mdyEvidence) {
    return { status: "resolved", order: "mdy", evidence: mdyEvidence, stats };
  }
  if (ambiguous.length > 0) {
    return { status: "ambiguous", samples: previewAmbiguity(ambiguous), stats };
  }
  if (stats.iso > 0 || stats.named > 0 || stats.serial > 0) {
    return { status: "resolved", order: null, evidence: null, stats };
  }
  return { status: "unusable", stats };
}

/**
 * Worked examples for the "which is it?" prompt.
 *
 * Discriminating values come first: `05/05/2020` reads identically both ways
 * and tells the admin nothing, so showing it as the example is worse than
 * useless — it makes the two options look the same and invites a coin flip.
 */
function previewAmbiguity(cells: Classified[]): AmbiguityPreview[] {
  const seen = new Set<string>();
  const previews: AmbiguityPreview[] = [];
  for (const cell of cells) {
    if (cell.shape !== "pair" || seen.has(cell.value)) continue;
    seen.add(cell.value);
    previews.push({
      value: cell.value,
      dmy: toISO(cell.year, cell.second, cell.first),
      mdy: toISO(cell.year, cell.first, cell.second),
    });
  }
  previews.sort((a, b) => Number(a.dmy === a.mdy) - Number(b.dmy === b.mdy));
  return previews.slice(0, AMBIGUITY_SAMPLE_LIMIT);
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** The server's refusal of a cell it doesn't read, in its words. */
function notReadMessage(value: string): string {
  return `"${value}" is not a date this importer recognises. Use YYYY-MM-DD.`;
}

/**
 * Read one cell exactly as the server reads it (`ValueNormalizer::date()`), in
 * its words. The rules, in the server's order, after a trim:
 *  1. With the column's order (`dmy` or `mdy`): a day and month then a
 *     four-digit year, split by "/", "-" or ".", read in that order, and the
 *     date must exist (PHP's `checkdate()`, no year 0). No warning: a person
 *     decided it.
 *  2. Otherwise the server's formats, each read back exactly as written:
 *     `Y-m-d`, `Y/m/d`, `m/d/Y`, `n/j/Y`, `d-M-Y`, `j M Y`, `M j, Y`. A
 *     month-first slash date that also reads day-first warns that it reads
 *     two ways.
 *  3. Otherwise a whole number from 20000 to 60000 is an Excel serial date,
 *     read with a warning.
 *  4. Anything else is refused.
 *
 * `order` is honoured strictly: a cell that isn't a real date in it is refused,
 * never swapped to the reading that works. A per-row swap is the same silent
 * re-dating as a wrong column verdict, just harder to spot.
 */
export function parseImportDate(
  raw: string,
  order: DateOrder | null,
): ParsedImportDate {
  const value = cellText(raw);
  if (!value) return { ok: false, reason: "blank", message: "This date is required and the cell is blank." };

  const pair = PAIR_SHAPE.exec(value);
  if (order && pair) {
    const [first, second, year] = [Number(pair[1]), Number(pair[2]), Number(pair[3])];
    const [day, month] = order === "dmy" ? [first, second] : [second, first];
    if (isRealDate(year, month, day, 1)) return { ok: true, iso: toISO(year, month, day), warning: null };
    return {
      ok: false,
      reason: "impossible",
      message: `"${value}" is not a real date read ${order === "dmy" ? "day-first" : "month-first"}, the order chosen for this column.`,
    };
  }

  const iso = ISO_SHAPE.exec(value);
  if (iso && isRealDate(Number(iso[1]), Number(iso[3]), Number(iso[4]))) {
    return { ok: true, iso: toISO(Number(iso[1]), Number(iso[3]), Number(iso[4])), warning: null };
  }

  for (const slash of [PADDED_SLASH, BARE_SLASH]) {
    const parts = slash.exec(value);
    if (!parts) continue;
    const [first, second, year] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
    if (!isRealDate(year, first, second)) continue;
    const chosen = toISO(year, first, second);
    const dayFirst = isRealDate(year, second, first) ? toISO(year, second, first) : null;
    const warning =
      dayFirst !== null && dayFirst !== chosen
        ? `"${value}" could be read as ${chosen} (month first, which is what will be used) or as ${dayFirst} (day first). Check it against the source workbook.`
        : null;
    return { ok: true, iso: chosen, warning };
  }

  const named = namedParts(value);
  if (named && isRealDate(named.year, named.month, named.day)) {
    return { ok: true, iso: toISO(named.year, named.month, named.day), warning: null };
  }

  if (INTEGER_SHAPE.test(value)) {
    const serial = Number(value);
    if (serial >= MIN_EXCEL_SERIAL && serial <= MAX_EXCEL_SERIAL) {
      const read = fromExcelSerial(serial);
      return {
        ok: true,
        iso: read,
        warning: `"${value}" is an Excel serial date number and will be read as ${read}. Confirm it against the source workbook.`,
      };
    }
  }

  const shape = classify(value).shape;
  return {
    ok: false,
    reason: shape === "short-year" ? "two-digit-year" : shape === "invalid" ? "impossible" : "unrecognised",
    message: notReadMessage(value),
  };
}

/**
 * Excel serial to calendar date.
 *
 * Built with the LOCAL `Date` constructor and read back with `formatDateISO`,
 * so the calendar day survives. The tempting version — offsetting `Date.UTC`
 * and calling `toISOString()` — lands on the previous day for every reader west
 * of UTC and is the same class of bug as the one that mis-dated payments.
 */
export function fromExcelSerial(serial: number): string {
  return formatDateISO(
    new Date(EXCEL_EPOCH.year, EXCEL_EPOCH.month, EXCEL_EPOCH.day + serial),
  );
}

/**
 * Is this `YYYY-MM-DD` after today, on the local calendar?
 *
 * A birthdate or a release date in the future is always an error, and usually
 * the error: it is what a mis-read `12/03/2027` looks like from the outside.
 * ISO dates compare lexicographically in date order, so a string comparison
 * against `todayISO()` is both correct and free — and it keeps the one honest
 * answer to "what is today?" in a single place.
 */
export function isFutureDate(iso: string): boolean {
  return iso > todayISO();
}
