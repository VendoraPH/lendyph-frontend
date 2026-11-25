/**
 * The rules the server holds a loans file's row to (`LoanRowNormalizer`,
 * finish run round 4), mirrored so the pre-check says which rows it will
 * refuse before a byte is uploaded. A prediction only: the server decides,
 * and nothing here rewrites the file.
 *
 * Required cells, lengths, the amounts and the two vocabularies are the
 * shared checks' (`missingRequiredFields`, `fieldSizeProblems`,
 * `resolveRowEnums`). What is left:
 *  - Term in Months, a whole number of months from 1 to 120;
 *  - a Purpose past 500 characters, which the server cuts (a warning).
 *
 * Pure, so it runs under `tsx --test`.
 */

import { columnsFor, type ImportRow } from "./import-schema";

export interface LoanFieldProblem {
  key: string;
  /** The column's printed label. */
  label: string;
  severity: "error" | "warning";
  category: "value" | "size";
  message: string;
  /** The cell as it appears in the file. */
  raw: string;
}

/** `LoanRowNormalizer::MAX_TERM_MONTHS`: the longest term the import takes. */
export const TERM_MONTHS_MAX = 120;

/** `loans.purpose`: the server keeps this many characters of a Purpose. */
export const PURPOSE_MAX = 500;

/**
 * A count as `ValueNormalizer::integer()` reads one: a non-breaking space is a
 * space, commas and spaces are dropped, and what is left must be digits.
 */
const WHOLE_NUMBER = /^\d+$/;

function labelOf(key: string): string {
  return columnsFor("loans").find((column) => column.key === key)?.label ?? key;
}

/** Characters as the server counts them (`mb_strlen`), not UTF-16 units. */
function characters(value: string): number {
  return [...value].length;
}

/** Every rule of the module docblock this row breaks. */
export function loanFieldProblems(row: ImportRow): LoanFieldProblem[] {
  const problems: LoanFieldProblem[] = [];
  const cell = (key: string) => (row[key] ?? "").trim();
  const add = (key: string, severity: LoanFieldProblem["severity"], category: LoanFieldProblem["category"], message: string) =>
    problems.push({ key, label: labelOf(key), severity, category, message, raw: cell(key) });

  const term = cell("term_months");
  if (term) {
    const digits = term.replace(/ /g, " ").replace(/[, ]/g, "");
    if (!WHOLE_NUMBER.test(digits)) {
      add("term_months", "error", "value", `Term in Months "${term}" isn't a whole number of months.`);
    } else if (Number(digits) < 1 || Number(digits) > TERM_MONTHS_MAX) {
      add("term_months", "error", "value", `Term in Months "${term}" is outside 1 to ${TERM_MONTHS_MAX} months, the terms the import takes.`);
    }
  }

  const purpose = cell("purpose");
  if (characters(purpose) > PURPOSE_MAX) {
    add("purpose", "warning", "size", `Purpose is ${characters(purpose)} characters. The import keeps the first ${PURPOSE_MAX}.`);
  }

  return problems;
}
