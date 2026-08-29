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
 * 1900-01-01. (Excel also believes 1900-02-29 existed, which throws serials
 * 1..60 out by a day. Still irrelevant: the accepted range starts at 3654, so
 * the phantom day is never in reach.) A CSV exported from the client's `.xlsm` turns any cell Excel considered
 * a real date into one of these integers, which is the single most common
 * artefact we will see.
 */
const EXCEL_EPOCH = { year: 1899, month: 11, day: 30 } as const;

/**
 * Accepted serial range: 3654 (1910-01-01) to 60000 (2064-04-08).
 *
 * The floor is about plausible member ages, NOT about telling a date apart from
 * an account number. It is tempting to narrow it for that second reason, and
 * the first draft did — but serial detection only ever runs on a column already
 * identified as a date column, so amounts, account numbers and monthly incomes
 * are never handed to this path and the false positive it guarded against is
 * unreachable. All a narrow floor bought was a bug: at 20000 the window started
 * in Oct 1954, so any member aged 72 or over — entirely ordinary in a
 * cooperative — had their birthdate reported as `unrecognised`.
 *
 * Anything nonsensical that gets through is caught downstream by the column's
 * own rules (`after:1900-01-01`, `before_or_equal:today` for Birthdate), which
 * is the right layer for it: those know which column they are validating.
 */
export const MIN_EXCEL_SERIAL = 3654;
export const MAX_EXCEL_SERIAL = 60000;

/** Years outside this are typos, not data. Applies to every parsed date. */
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

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
  /** Reads both ways and no order was supplied. */
  | "ambiguous"
  /** Date-shaped, but not a date that exists (or outside 1900-2100). */
  | "impossible"
  /** `03/04/55` — the century is not knowable, and we will not invent one. */
  | "two-digit-year"
  /** Not a date in any shape we recognise. */
  | "unrecognised";

export type ParsedImportDate =
  | { ok: true; iso: string }
  | { ok: false; reason: DateParseFailure };

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

const ISO_SHAPE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;
const PAIR_SHAPE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;
const SHORT_YEAR_SHAPE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/;
const INTEGER_SHAPE = /^\d+$/;

/**
 * Excel writes date-formatted cells to CSV with the time still attached
 * (`03/04/2020 00:00:00`), and anything that has been through a JSON round trip
 * arrives as `2020-03-04T00:00:00.000Z`. The time is dropped, NOT converted:
 * the number in the cell is a wall clock the client typed, so the date beside
 * it is the date they meant. Converting a `Z` instant to local time here would
 * reintroduce the off-by-one-day bug from the other direction.
 */
const TRAILING_TIME = /[ T]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\s*([ap]\.?m\.?)?\s*(z|[+-]\d{2}:?\d{2})?$/i;

type Classified =
  | { shape: Exclude<DateShape, "pair" | "iso" | "serial">; value: string }
  | { shape: "iso"; value: string; year: number; month: number; day: number }
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

/** Does this Y/M/D name a day that actually happened? */
function isRealDate(year: number, month: number, day: number): boolean {
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  // Round-trip through Date: `new Date(2020, 1, 31)` silently becomes 2 March,
  // which is precisely the overflow an import must never perform quietly.
  const probe = new Date(year, month - 1, day);
  return (
    probe.getFullYear() === year &&
    probe.getMonth() === month - 1 &&
    probe.getDate() === day
  );
}

/** `YYYY-MM-DD` from calendar parts, via local fields — never `toISOString`. */
function toISO(year: number, month: number, day: number): string {
  return formatDateISO(new Date(year, month - 1, day));
}

function classify(raw: string): Classified {
  const value = String(raw ?? "").trim().replace(TRAILING_TIME, "").trim();
  if (!value) return { shape: "blank", value: "" };

  const iso = ISO_SHAPE.exec(value);
  if (iso) {
    const [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    return isRealDate(year, month, day)
      ? { shape: "iso", value, year, month, day }
      : { shape: "invalid", value };
  }

  const pair = PAIR_SHAPE.exec(value);
  if (pair) {
    const first = Number(pair[1]);
    const second = Number(pair[2]);
    const year = Number(pair[3]);
    const dmy = isRealDate(year, second, first);
    const mdy = isRealDate(year, first, second);
    // Valid under neither reading (`31/13/2020`, `30/02/2020`) is an impossible
    // date, not evidence of an order. Treating it as evidence is how one bad
    // row would decide a whole column, or fake a conflict that is not there.
    if (!dmy && !mdy) return { shape: "invalid", value };
    return { shape: "pair", value, first, second, year, dmy, mdy };
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
  return shape === "iso" || shape === "pair" || shape === "serial";
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
 *  - ISO and Excel serials carry their own meaning, so a column made only of
 *    those is resolved with no order to choose.
 */
export function inferDateFormat(values: readonly string[]): DateFormatInference {
  const stats: DateColumnStats = {
    total: values.length,
    blank: 0,
    iso: 0,
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
  if (stats.iso > 0 || stats.serial > 0) {
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

/**
 * Turn one cell into a `YYYY-MM-DD` calendar date, or say why it cannot be.
 *
 * `order` is honoured STRICTLY. A cell of `31/03/2020` parsed as `mdy` fails as
 * `impossible` rather than quietly swapping itself to the reading that works —
 * a per-row swap is the same silent re-dating as a wrong column verdict, just
 * harder to spot. `inferDateFormat` never produces an order that contradicts
 * its own column, so this only fires on an admin override, which is exactly
 * when they need telling.
 *
 * ISO and Excel serials are self-describing and parse identically under any
 * order, so `order` governs only the two-component family.
 */
export function parseImportDate(
  raw: string,
  order: DateOrder | null,
): ParsedImportDate {
  const cell = classify(raw);
  switch (cell.shape) {
    case "blank":
      return { ok: false, reason: "blank" };
    case "iso":
      return { ok: true, iso: toISO(cell.year, cell.month, cell.day) };
    case "serial":
      return { ok: true, iso: fromExcelSerial(cell.serial) };
    case "short-year":
      return { ok: false, reason: "two-digit-year" };
    case "invalid":
      return { ok: false, reason: "impossible" };
    case "unrecognised":
      return { ok: false, reason: "unrecognised" };
    case "pair": {
      if (order === "dmy") {
        return cell.dmy
          ? { ok: true, iso: toISO(cell.year, cell.second, cell.first) }
          : { ok: false, reason: "impossible" };
      }
      if (order === "mdy") {
        return cell.mdy
          ? { ok: true, iso: toISO(cell.year, cell.first, cell.second) }
          : { ok: false, reason: "impossible" };
      }
      // No order given. A value that reads only one way is not a guess, so it
      // is allowed through; one that reads both ways is refused.
      if (cell.dmy && cell.mdy) return { ok: false, reason: "ambiguous" };
      return cell.dmy
        ? { ok: true, iso: toISO(cell.year, cell.second, cell.first) }
        : { ok: true, iso: toISO(cell.year, cell.first, cell.second) };
    }
  }
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
