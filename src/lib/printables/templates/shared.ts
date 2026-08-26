/**
 * Helpers shared by every printable template. Not a template itself.
 *
 * Two rules hold across this folder:
 *
 * 1. **Templates are pure.** A template is `(payload, options) -> PrintableDocument`
 *    and nothing else — no fetching, no `window`, no session. That is what makes
 *    the whole API-to-paper contract testable without a browser, exactly as
 *    `reports/_lib/report-builders.ts` already is.
 * 2. **Templates fail soft.** A rejected request arrives here as `null`, and the
 *    document that comes back is a blank form the branch can print and fill in
 *    by hand. Nothing throws.
 *
 * Money and dates are formatted with the report formatters so a peso prints the
 * same way on a receipt as it does in a report.
 */

import {
  DASH,
  currencyOrDash,
  formatCurrency,
  formatGeneratedAt,
  formatValue,
  toNumber,
} from "@/app/(app)/reports/_lib/formatters";
import type { PrintableOrg, PrintField } from "../types";

export { DASH, currencyOrDash, formatCurrency, toNumber };

/**
 * Written into prose where a value is missing. A paragraph cannot carry a
 * `underline` rule the way a `fields` row can, so the blank is drawn with
 * characters instead.
 */
export const BLANK_LINE = "_______________";

/** Letterhead used when a document is built outside a page context (tests). */
export const BLANK_ORG: PrintableOrg = { name: "", logoUrl: null };

/**
 * Rows requested when a document reads a paginated list endpoint.
 *
 * 100, not a larger round number, because that is the ceiling the API actually
 * serves: every paginated index in this backend does
 * `paginate(min((int) request('per_page', 15), 100))`. Asking for 200 does not
 * fetch 200 — it fetches 100 and leaves the caller believing it asked for
 * enough, which is how a ledger gets silently truncated. A document that reads
 * a list must therefore assume it may have been capped and say so; see
 * `share-capital-certificate.ts`.
 */
export const PRINT_PAGE_SIZE = 100;

/** Everything a template may vary that is not the API payload. */
export interface PrintableBuildOptions {
  /** Letterhead identity, resolved by `print-chrome` before the build. */
  org?: PrintableOrg;
  /**
   * "Now" for anything the document derives from the calendar — a cure-period
   * deadline, an as-of date. Injectable so tests are deterministic.
   */
  now?: Date;
}

// ---------------------------------------------------------------------------
// Raw payload readers
//
// Same shape as the report builders': the API is read defensively, first key
// wins, and the aliases behind it are the ones older responses used.
// ---------------------------------------------------------------------------

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((v) => v && typeof v === "object") as Record<
      string,
      unknown
    >[];
  }
  const obj = asRecord(value);
  if (!obj) return [];
  for (const key of ["data", "rows", "items", "results", "entries"]) {
    if (Array.isArray(obj[key])) {
      return (obj[key] as unknown[]).filter(
        (v) => v && typeof v === "object"
      ) as Record<string, unknown>[];
    }
  }
  return [];
}

export function pick<T = unknown>(
  obj: Record<string, unknown> | null | undefined,
  keys: string[]
): T | null {
  if (!obj) return null;
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== "") {
      return value as T;
    }
  }
  return null;
}

/** `pick`, coerced to a finite number. */
export function pickNumber(
  obj: Record<string, unknown> | null | undefined,
  keys: string[]
): number | null {
  return toNumber(pick(obj, keys));
}

export function sum(rows: Record<string, unknown>[], key: string): number {
  return rows.reduce((acc, row) => acc + (toNumber(row[key]) ?? 0), 0);
}

/**
 * A person's name from either a nested user/borrower object or the flat alias
 * beside it. `released_by_user` is an object; `released_by` is a string.
 */
export function personName(
  parent: Record<string, unknown> | null,
  objectKey: string,
  flatKeys: string[] = []
): string | null {
  const nested = asRecord(parent?.[objectKey]);
  const fromNested = pick<string>(nested, ["full_name", "name", "username"]);
  if (fromNested) return String(fromNested);
  const flat = pick<string>(parent, flatKeys);
  return flat ? String(flat) : null;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** `bi_weekly` -> `Bi weekly`. Matches the wording the old templates printed. */
export function humanize(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).replace(/_/g, " ").trim();
  if (!text) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function textOrBlank(value: unknown): string {
  if (value === null || value === undefined || value === "") return BLANK_LINE;
  return String(value);
}

// ---------------------------------------------------------------------------
// Dates
//
// One rule, and every date in this folder goes through it: a `YYYY-MM-DD` from
// the API is a CALENDAR date, not an instant.
//
// `new Date("2026-08-26")` is specified to parse as UTC midnight, which in
// Manila is 08:00 on the 26th. Anything that then subtracts or compares against
// a local "now" is wrong for the first eight hours of every working day — a
// demand letter printed at 07:00 counted an installment due yesterday as not
// yet due at all. Anything that *formats* it is wrong by a whole day in any
// timezone west of UTC. Parsing the parts into a local Date removes both.
// ---------------------------------------------------------------------------

/** `YYYY-MM-DD`, with nothing after it. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * An API date value as a `Date` in the reader's own timezone, or null.
 *
 * Date-only strings are built from their parts so they land on local midnight
 * of the day they name. Everything else (a `YYYY-MM-DD HH:mm:ss` timestamp, an
 * ISO instant, a `Date`) is left to the platform, which already reads those as
 * the instant they denote.
 */
export function parseApiDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const text = String(value).trim();
  const parts = DATE_ONLY.exec(text);
  if (parts) {
    return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Midnight of the day `date` falls on, locally. The day-counting baseline. */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function dateOrBlank(value: unknown): string {
  if (value === null || value === undefined || value === "") return BLANK_LINE;
  return formatValue(parseApiDate(value) ?? value, "date");
}

export function dateOrDash(value: unknown): string {
  if (value === null || value === undefined || value === "") return DASH;
  return formatValue(parseApiDate(value) ?? value, "date");
}

export function moneyOrBlank(value: unknown): string {
  const n = toNumber(value);
  return n === null ? BLANK_LINE : formatCurrency(n);
}

/**
 * HTML-escape a value before it is interpolated into a `paragraph` block.
 *
 * `paragraph.html` is authored in this repo, but the values dropped into it are
 * borrower names and addresses that came off the wire. Without this, a member
 * called `<script>` would be executed by the print window.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escaped, emphasised, and underlined — how legal prose fills in a blank. */
export function fill(value: unknown): string {
  const text =
    value === null || value === undefined || value === ""
      ? BLANK_LINE
      : String(value);
  return `<strong><u>${escapeHtml(text)}</u></strong>`;
}

/**
 * A `fields` row that draws a rule when the API had nothing to show. A blank
 * line is the point of a printed form; a dash reads as broken data.
 */
export function field(label: string, value: unknown): PrintField {
  if (value === null || value === undefined || value === "") {
    return { label, underline: true };
  }
  return { label, value: String(value) };
}

/**
 * A `fields` row holding a date.
 *
 * `field()` stringifies, so a date handed to it prints the raw API value —
 * `Date: 2026-08-26` in a fields block directly above `Date: Aug 26, 2026` in
 * the signature detail underneath, on the same receipt. Every date that reaches
 * a `fields` block goes through this instead, so one document states a date one
 * way.
 */
export function dateField(label: string, value: unknown): PrintField {
  if (value === null || value === undefined || value === "") {
    return { label, underline: true };
  }
  return { label, value: formatValue(parseApiDate(value) ?? value, "date") };
}

/**
 * As `dateField`, keeping the time of day.
 *
 * For the handful of values where the minute is the point — when a payment was
 * voided, not merely the day it was voided on.
 */
export function dateTimeField(label: string, value: unknown): PrintField {
  if (value === null || value === undefined || value === "") {
    return { label, underline: true };
  }
  return { label, value: formatValue(parseApiDate(value) ?? value, "datetime") };
}

/** Drop the rows the API did not send, keeping a document honest about gaps. */
export function presentFields(items: (PrintField | null)[]): PrintField[] {
  return items.filter((item): item is PrintField => item !== null);
}

// ---------------------------------------------------------------------------
// Loan frequency: term units and rate annualisation
//
// The single most dangerous assumption a document in this folder can make is
// that a loan is monthly.
//
// `LoanService` applies `interest_rate` ONCE PER PERIOD and counts `term` IN
// PERIODS — `buildStraight`, `buildDiminishing` and `buildUponMaturity` all
// multiply by the rate per iteration, and `computeMaturityDate` advances by
// days / weeks / 14 days / 15 days / months depending on `frequency`. The
// "monthly rate (PH convention)" comments in that service describe the common
// case, not the arithmetic.
//
// So `${rate}% per month` and `${(rate * 12)}% per annum` are true only for a
// monthly loan. On a 1%-per-day loan they disclose 12.00% per annum against a
// real nominal of 365%. Stating the annual rate correctly is the entire
// statutory purpose of an R.A. 3765 disclosure, so no template may write either
// phrase by hand; they call these instead.
// ---------------------------------------------------------------------------

/** Every value `loans.frequency` can hold, per the enum and `LoanFrequency`. */
export type LoanFrequency =
  | "daily"
  | "weekly"
  | "bi_weekly"
  | "semi_monthly"
  | "monthly"
  | "upon_maturity";

interface FrequencyMeta {
  /**
   * Periods in a year — the multiplier that turns a periodic rate into a
   * nominal annual one.
   *
   * The conventional counts (365 / 52 / 26 / 24 / 12) rather than the exact
   * ones implied by the generator's step size (`semi_monthly` advances 15 days,
   * so 24.33 periods land in a calendar year). The convention is what a
   * disclosure is read against, and the difference is a rounding argument —
   * unlike the 30× error these replace.
   */
  periodsPerYear: number;
  /** Singular noun for one period, as a term is counted in them. */
  termNoun: string;
  /** How a rate reads after the figure: "1% per day". */
  ratePhrase: string;
}

const FREQUENCY_META: Record<LoanFrequency, FrequencyMeta> = {
  daily: { periodsPerYear: 365, termNoun: "day", ratePhrase: "per day" },
  weekly: { periodsPerYear: 52, termNoun: "week", ratePhrase: "per week" },
  bi_weekly: {
    periodsPerYear: 26,
    termNoun: "bi-weekly period",
    ratePhrase: "per bi-weekly period",
  },
  semi_monthly: {
    periodsPerYear: 24,
    termNoun: "semi-monthly period",
    ratePhrase: "per semi-monthly period",
  },
  monthly: { periodsPerYear: 12, termNoun: "month", ratePhrase: "per month" },
  // A bullet loan's `term` is months-until-maturity — `computeMaturityDate`
  // handles 'monthly' and 'upon_maturity' in the same arm — and its interest is
  // principal × rate × term, i.e. still a monthly periodic rate.
  upon_maturity: {
    periodsPerYear: 12,
    termNoun: "month",
    ratePhrase: "per month",
  },
};

/** The frequency a payload names, or null when it names none we know. */
export function readFrequency(value: unknown): LoanFrequency | null {
  if (value === null || value === undefined || value === "") return null;
  const key = String(value).trim().toLowerCase();
  return key in FREQUENCY_META ? (key as LoanFrequency) : null;
}

/** Periods in a year for a frequency, or null when it is unknown. */
export function periodsPerYear(frequency: unknown): number | null {
  const key = readFrequency(frequency);
  return key === null ? null : FREQUENCY_META[key].periodsPerYear;
}

/**
 * `"6 month(s)"`, `"30 day(s)"`, `"12 week(s)"`.
 *
 * Falls back to the neutral "period(s)" when the frequency is unknown, which is
 * honest — `term` really is a count of periods — rather than guessing months.
 */
export function termLabel(term: number | null, frequency: unknown): string | null {
  if (term === null) return null;
  const key = readFrequency(frequency);
  const noun = key === null ? "period" : FREQUENCY_META[key].termNoun;
  return `${term} ${noun}(s)`;
}

/**
 * `termLabel` reading the term straight off a payload.
 *
 * `term` is a count of the loan's OWN periods and takes the unit from
 * `frequency`. `term_months` — a key only the legacy flat shapes in
 * `src/types/loan-document.ts` ever used — names its unit in its name, so a
 * value that arrives under it is labelled in months whatever `frequency` says.
 * Reading them through one `pick` list, as every template used to, silently
 * relabels one as the other.
 */
export function termLabelFrom(
  source: Record<string, unknown> | null,
  frequency: unknown
): string | null {
  const periods = pickNumber(source, ["term"]);
  if (periods !== null) return termLabel(periods, frequency);
  return termLabel(pickNumber(source, ["term_months"]), "monthly");
}

/** `"1% per day"`, `"2.5% per month"`. The rate exactly as it is applied. */
export function rateLabel(rate: number | null, frequency: unknown): string | null {
  if (rate === null) return null;
  const key = readFrequency(frequency);
  const phrase = key === null ? "per period" : FREQUENCY_META[key].ratePhrase;
  return `${rate}% ${phrase}`;
}

/**
 * `"365.00% per annum"` for 1% per day. Null when the loan's frequency is
 * unknown, because there is then no honest multiplier — and a `fields` row
 * built from null prints a rule to be completed rather than a wrong figure.
 */
export function annualRateLabel(
  rate: number | null,
  frequency: unknown
): string | null {
  if (rate === null) return null;
  const periods = periodsPerYear(frequency);
  if (periods === null) return null;
  return `${(rate * periods).toFixed(2)}% per annum`;
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

/**
 * What an itemised stack is missing before it adds up to the total.
 *
 * Both the release voucher and the disclosure prefer the server's
 * `total_deductions` over the sum of the `deductions[]` it also sent — the
 * server is the authority on what was withheld, and a voucher that disagrees
 * with the cash is worthless. But when the array is empty or short, the printed
 * lines then visibly fail to add up to the printed total, and the reader is
 * left to do the subtraction. This is the difference, to the centavo, so each
 * document can print it as a line of its own.
 */
export function unitemisedRemainder(total: number, itemised: number): number {
  return Math.round((total - itemised) * 100) / 100;
}

/** Timestamp for a freshly built document. `print-chrome` may restamp it. */
export function generatedAt(now?: Date): string {
  return formatGeneratedAt(now ?? new Date());
}

/** Add `days` to a date without mutating it — cure periods, grace windows. */
export function addDays(from: Date, days: number): Date {
  const next = new Date(from.getTime());
  next.setDate(next.getDate() + days);
  return next;
}
