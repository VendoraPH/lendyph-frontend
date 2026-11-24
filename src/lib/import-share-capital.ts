/**
 * The rules the server holds the share capital file to
 * (`ShareCapitalRowNormalizer`, finish run round 2, decision 13), mirrored so
 * the pre-check says which rows it will refuse before a byte is uploaded. A
 * prediction only: the server decides, and nothing here rewrites the file.
 *
 * Required cells, lengths, the amount's form and the transaction type's words
 * are the shared checks' (`missingRequiredFields`, `fieldSizeProblems`,
 * `resolveRowEnums`). What is left:
 *  - Transaction Date written year-month-day, a real date, from 1900 and not
 *    after today;
 *  - an amount above ₱0.00 (a withdrawal is a positive amount);
 *  - Remarks past 255 characters, which the server shortens (a warning);
 *  - a row repeating an earlier row of the file (`shareCapitalRepeats`).
 *
 * Pure, so it runs under `tsx --test`.
 */

import { columnsFor, normaliseNumericValue, type ImportRow } from "./import-schema";

export interface ShareCapitalFieldProblem {
  key: string;
  /** The column's printed label. */
  label: string;
  severity: "error" | "warning";
  category: "date" | "value" | "size";
  message: string;
  /** The cell as it appears in the file. */
  raw: string;
}

/** `share_capital_ledger.description`: Remarks past this is shortened. */
export const REMARKS_MAX = 255;

const EARLIEST_DATE = "1900-01-01";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** An amount as `normaliseNumericValue` leaves it: digits, a point, a sign. */
const AMOUNT = /^(-?)(\d*)(?:\.(\d*))?$/;

function labelOf(key: string): string {
  return columnsFor("share_capital").find((column) => column.key === key)?.label ?? key;
}

/** A real calendar date written `YYYY-MM-DD`, and nothing else. */
export function isCalendarDateISO(value: string): boolean {
  const parts = ISO_DATE.exec(value);
  if (!parts) return false;
  const [year, month, day] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * An amount cell in centavos, exactly (no float on the way), or null when it
 * isn't an amount `fieldSizeProblems` would let through. `-500` is -50000.
 */
export function amountCentavos(raw: string): number | null {
  const parts = AMOUNT.exec(normaliseNumericValue(raw));
  if (!parts || (parts[2] === "" && (parts[3] ?? "") === "")) return null;
  const fraction = (parts[3] ?? "").replace(/0+$/, "");
  if (fraction.length > 2) return null;
  const centavos = Number(parts[2] || "0") * 100 + Number(fraction.padEnd(2, "0"));
  return parts[1] === "-" ? -centavos : centavos;
}

/** Every rule of the class docblock this row breaks, but the repeat. */
export function shareCapitalFieldProblems(row: ImportRow, today: string): ShareCapitalFieldProblem[] {
  const problems: ShareCapitalFieldProblem[] = [];
  const cell = (key: string) => (row[key] ?? "").trim();
  const add = (key: string, severity: ShareCapitalFieldProblem["severity"], category: ShareCapitalFieldProblem["category"], message: string) =>
    problems.push({ key, label: labelOf(key), severity, category, message, raw: cell(key) });

  const date = cell("transaction_date");
  if (date) {
    // Both are `YYYY-MM-DD`, so the strings compare as the dates do.
    if (!isCalendarDateISO(date)) {
      add("transaction_date", "error", "date", `Transaction Date "${date}" isn't a date written as year-month-day, such as 2026-11-24.`);
    } else if (date < EARLIEST_DATE) {
      add("transaction_date", "error", "date", `Transaction Date "${date}" is before 1900, too early for a share capital entry. Check the year.`);
    } else if (date > today) {
      add("transaction_date", "error", "date", `Transaction Date "${date}" is after today, and a share capital entry can't be dated in the future.`);
    }
  }

  const centavos = cell("amount") ? amountCentavos(cell("amount")) : null;
  if (centavos !== null && centavos < 0) {
    add("amount", "error", "value", `Amount "${cell("amount")}" is a negative amount, which can't be imported. A withdrawal is written as a positive amount with Transaction Type Withdrawal.`);
  } else if (centavos === 0) {
    add("amount", "error", "value", "Amount is ₱0.00. A share capital entry moves money, so its amount must be above ₱0.00.");
  }

  const remarks = cell("remarks");
  if (remarks.length > REMARKS_MAX) {
    add("remarks", "warning", "size", `Remarks is ${remarks.length} characters. The import keeps the first ${REMARKS_MAX} as the entry's description.`);
  }

  return problems;
}

export interface ShareCapitalRepeat {
  /** The column at fault: the reference's, or `null` for the whole row. */
  column: string | null;
  message: string;
  value: string | null;
}

/**
 * A tracker for one file's rows, in file order: it answers whether a row
 * repeats an earlier one, and otherwise remembers it. Call it only for a row
 * with no error of its own, as the server remembers only valid rows.
 *
 * - A row with a reference repeats an earlier row with the same reference, in
 *   any case.
 * - A row without one repeats an earlier row with the same member, date, type
 *   and amount, a referenced row included: nothing tells the two apart.
 *
 * `row` is resolved (`resolveRowEnums`), so the type is its stored value.
 */
export function shareCapitalRepeats(): (row: ImportRow, line: number) => ShareCapitalRepeat | null {
  const references = new Map<string, number>();
  const figures = new Map<string, number>();

  return (row, line) => {
    const cell = (key: string) => (row[key] ?? "").trim();
    const reference = cell("reference_number");
    const key = [cell("account_no").toLowerCase(), cell("transaction_date"), cell("transaction_type"), amountCentavos(cell("amount"))].join("\u001f");

    if (reference) {
      const first = references.get(reference.toLowerCase());
      if (first !== undefined) {
        return {
          column: labelOf("reference_number"),
          message: `Reference ${reference} is also on line ${first} of this file. A reference number belongs to one transaction, so only that first row is imported.`,
          value: reference,
        };
      }
      references.set(reference.toLowerCase(), line);
    } else {
      const first = figures.get(key);
      if (first !== undefined) {
        return {
          column: null,
          message: `This row repeats line ${first} of this file: the same member, date, type and amount, with no reference number. Only that first row is imported; if both are real, give each its own reference number.`,
          value: null,
        };
      }
    }

    if (!figures.has(key)) figures.set(key, line);
    return null;
  };
}
