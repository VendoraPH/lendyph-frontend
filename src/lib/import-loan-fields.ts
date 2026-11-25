/**
 * The rules the server holds a loans file's row to, mirrored so the pre-check
 * says which rows it will refuse before a byte is uploaded (finish run round
 * 4). A prediction only: the server decides, and nothing here rewrites the
 * file. Each refusal is the server's own condition, in the server's words:
 *  - every amount as `ValueNormalizer::centavos()` reads one: no negative or
 *    accounting-notation amount, at most two decimal places, an amount's form,
 *    and at most ₱9,999,999,999.99;
 *  - Interest Rate as `ValueNormalizer::rate()` reads it;
 *  - Term in Months as `ValueNormalizer::integer()` reads it, 1 to 120;
 *  - `LoanRowNormalizer::checkRelationships()`: a maturity date after the
 *    date released, balances no larger than their amounts, a loan amount above
 *    zero, and (a warning) an other fee with a description;
 *  - `CsvImportProcessor::deductionsFor()`: fees no larger than the principal.
 * A Purpose past 500 characters, and a Loan Product or Other Fee Detail past
 * 255, are cut by the server, which the pre-check says (a warning).
 *
 * Required cells, the two identifiers' lengths and the two vocabularies are
 * the shared checks' (`missingRequiredFields`, `fieldSizeProblems`,
 * `resolveRowEnums`); dates are read by the caller, with the order the admin
 * settled.
 *
 * Pure, so it runs under `tsx --test`.
 */

import { columnsFor, type ImportRow } from "./import-schema";

export interface LoanFieldProblem {
  /** The column at fault, or `null` for the whole row. */
  key: string | null;
  /** The column's printed label, or `null` for the whole row. */
  label: string | null;
  severity: "error" | "warning";
  category: "value" | "size" | "date";
  message: string;
  /** The cell as it appears in the file, or `null` for the whole row. */
  raw: string | null;
}

export interface LoanFieldContext {
  /** `YYYY-MM-DD` each date cell was read as, by column key. Absent when unread. */
  dates: Readonly<Partial<Record<string, string>>>;
}

/** `LoanRowNormalizer::MAX_TERM_MONTHS`: the longest term the import takes. */
export const TERM_MONTHS_MAX = 120;

/** `loans.purpose`: the server keeps this many characters of a Purpose. */
export const PURPOSE_MAX = 500;

/** What the server keeps of a Loan Product (`LoanRowNormalizer`). */
export const LOAN_PRODUCT_MAX = 255;

/** What the server keeps of an Other Fee Detail (`LoanRowNormalizer`). */
export const OTHER_FEE_DETAIL_MAX = 255;

/** `ValueNormalizer::MAX_CENTAVOS`: ₱9,999,999,999.99. Whole centavos are BigInt, exact at any length. */
const MAX_CENTAVOS = BigInt("999999999999");
const ZERO = BigInt(0);
const CENTAVOS_PER_PESO = BigInt(100);

/** `decimal(8,4)`, as `ValueNormalizer::rate()` caps it. */
const MAX_RATE = 9999.9999;

type Reading<T> = { ok: true; value: T } | { ok: false; message: string };

function labelOf(key: string): string {
  return columnsFor("loans").find((column) => column.key === key)?.label ?? key;
}

/** Characters as the server counts them (`mb_strlen`), not UTF-16 units. */
function characters(value: string): number {
  return [...value].length;
}

/**
 * A cell as `ValueNormalizer::text()` leaves it: byte-order marks dropped, a
 * non-breaking space a space, trimmed.
 */
function serverText(raw: string): string {
  return raw.replace(/\uFEFF/g, "").replace(/\u00A0/g, " ").trim();
}

/** `ValueNormalizer::centavos()`: an amount in whole centavos, or its refusal. */
function readCentavos(original: string): Reading<bigint> {
  if (original.startsWith("(") || original.endsWith(")")) {
    return { ok: false, message: `"${original}" is written in accounting notation for a negative amount. Negative amounts cannot be imported.` };
  }
  const value = original.replace(/[₱, \u00A0]/g, "").replace(/php/gi, "").replace(/^\++/, "");
  if (value.startsWith("-") || value.endsWith("-")) {
    return { ok: false, message: `"${original}" is a negative amount, which cannot be imported.` };
  }
  if (/^\d*\.\d{3,}$/.test(value)) {
    return {
      ok: false,
      message: `"${original}" has more than 2 decimal places. Round it to centavos in the source file — this importer will not round it for you.`,
    };
  }
  if (!/^(\d+(\.\d{1,2})?|\.\d{1,2})$/.test(value)) {
    return { ok: false, message: `"${original}" is not a valid amount.` };
  }
  const [whole, fraction = ""] = value.split(".");
  const centavos = BigInt(whole === "" ? "0" : whole) * CENTAVOS_PER_PESO + BigInt(fraction.padEnd(2, "0"));
  if (centavos > MAX_CENTAVOS) {
    return { ok: false, message: `"${original}" is larger than the maximum this system stores (9,999,999,999.99).` };
  }
  return { ok: true, value: centavos };
}

/** `ValueNormalizer::rate()`: percent signs, spaces and commas dropped. */
function readRate(original: string): Reading<string> {
  const value = original.replace(/[% ,]/g, "").trimEnd();
  if (!/^\d+(\.\d{1,4})?$/.test(value)) {
    return { ok: false, message: `"${original}" is not a valid interest rate.` };
  }
  if (Number(value) > MAX_RATE) {
    return { ok: false, message: `"${original}" is larger than the maximum interest rate this system stores.` };
  }
  return { ok: true, value };
}

/** `ValueNormalizer::integer()`, held to 1 to `TERM_MONTHS_MAX`. */
function readTerm(original: string): Reading<number> {
  const value = original.replace(/[, ]/g, "");
  if (!/^\d+$/.test(value)) {
    return { ok: false, message: `"${original}" is not a whole number.` };
  }
  const months = Number(value);
  if (months < 1 || months > TERM_MONTHS_MAX) {
    return { ok: false, message: `"${original}" is outside the accepted range 1–${TERM_MONTHS_MAX}.` };
  }
  return { ok: true, value: months };
}

/** How the server reads each cell these rules check, by column key. */
const READERS: Readonly<Partial<Record<string, (original: string) => Reading<unknown>>>> = {
  loan_amount: readCentavos,
  loan_balance: readCentavos,
  interest_rate: readRate,
  interest_amount: readCentavos,
  interest_balance: readCentavos,
  term_months: readTerm,
  processing_fee: readCentavos,
  service_fee: readCentavos,
  other_fee_amount: readCentavos,
};

/** The cells the server cuts to fit, with a warning, and what it keeps. */
const CUT_AT: Readonly<Partial<Record<string, number>>> = {
  purpose: PURPOSE_MAX,
  loan_product: LOAN_PRODUCT_MAX,
  other_fee_detail: OTHER_FEE_DETAIL_MAX,
};

/** Every rule of the module docblock this row breaks, in the server's order. */
export function loanFieldProblems(row: ImportRow, context: LoanFieldContext): LoanFieldProblem[] {
  const problems: LoanFieldProblem[] = [];
  const cell = (key: string) => serverText(row[key] ?? "");
  const add = (key: string | null, severity: LoanFieldProblem["severity"], category: LoanFieldProblem["category"], message: string) =>
    problems.push({
      key,
      label: key === null ? null : labelOf(key),
      severity,
      category,
      message,
      raw: key === null ? null : cell(key),
    });

  // Each cell as the server reads it, in the file's column order. An amount
  // that reads is kept, in centavos, for the checks between cells below.
  const amounts: Partial<Record<string, bigint>> = {};
  for (const { key } of columnsFor("loans")) {
    const original = cell(key);
    if (!original) continue; // Blank is `missingRequiredFields`' question.
    const keeps = CUT_AT[key];
    if (keeps !== undefined && characters(original) > keeps) {
      add(key, "warning", "size", `${labelOf(key)} is ${characters(original)} characters. The import keeps the first ${keeps}.`);
    }
    const reading = READERS[key]?.(original);
    if (reading && !reading.ok) add(key, "error", "value", reading.message);
    else if (typeof reading?.value === "bigint") amounts[key] = reading.value;
  }

  // `LoanRowNormalizer::checkRelationships()`, on the values that read.
  const released = context.dates.date_released;
  const maturity = context.dates.maturity_date;
  // Both are `YYYY-MM-DD`, so the strings compare as the dates do.
  if (released && maturity && maturity <= released) {
    add("maturity_date", "error", "date", `The maturity date (${maturity}) is not after the date released (${released}), so no payment schedule can be built.`);
  }
  const { loan_amount: amount, loan_balance: balance, interest_amount: interest, interest_balance: interestBalance } = amounts;
  if (amount !== undefined && balance !== undefined && balance > amount) {
    add("loan_balance", "error", "value", "The loan balance is larger than the loan amount. A balance cannot exceed the principal that was released.");
  }
  if (amount !== undefined && amount <= ZERO) {
    add("loan_amount", "error", "value", "The loan amount must be greater than zero.");
  }
  if (interest !== undefined && interestBalance !== undefined && interestBalance > interest) {
    add("interest_balance", "error", "value", "The interest balance is larger than the total interest. A balance cannot exceed what was charged.");
  }
  const otherFee = amounts.other_fee_amount;
  if (otherFee !== undefined && otherFee > ZERO && cell("other_fee_detail") === "") {
    add(
      "other_fee_detail",
      "warning",
      "value",
      "An other-fee amount was given with no description. The disclosure statement has to itemise every deduction, so a description will need to be added.",
    );
  }

  // `CsvImportProcessor::deductionsFor()`: the fees above zero, against the principal.
  if (amount !== undefined) {
    const fees = (["processing_fee", "service_fee", "other_fee_amount"] as const)
      .map((key) => amounts[key] ?? ZERO)
      .filter((fee) => fee > ZERO)
      .reduce((sum, fee) => sum + fee, ZERO);
    if (fees > amount) {
      add(
        null,
        "error",
        "value",
        "The fees on this loan add up to more than the principal, which would make its net proceeds negative. Check the Processing Fee, Service Fee and Other Fee Amount cells.",
      );
    }
  }

  return problems;
}
