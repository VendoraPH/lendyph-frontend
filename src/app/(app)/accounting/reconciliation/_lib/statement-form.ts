import { toCentavos } from "@/lib/accounting/money";
import { getErrorMessage, httpStatusOf } from "@/lib/api-error";
import { parseCsv } from "@/lib/csv-parse";
import { BRANCH_ACCESS_EXPLANATION } from "./reconciliation-view";
import type { CreateReconciliationBody, NewStatementLine } from "./types";

/**
 * The "New reconciliation" form: what the statement says, as typed or pasted,
 * turned into `StoreReconciliationRequest`'s body. Pesos become centavos only
 * through `toCentavos`; the server checks the shape again.
 */

/** `StoreReconciliationRequest::MAX_LINES`, and the other column caps it checks. */
export const STATEMENT_LINES_MAX = 1000;
export const PERIOD_MAX = 48;
export const DESCRIPTION_MAX = 500;
export const REFERENCE_MAX = 64;

/** One statement line as typed: every field is the text in its box. */
export interface DraftLine {
  date: string;
  description: string;
  amount: string;
  reference: string;
}

export const BLANK_LINE: DraftLine = { date: "", description: "", amount: "", reference: "" };

export interface StatementForm {
  accountId: number | null;
  period: string;
  startDate: string;
  endDate: string;
  statementBalance: string;
  lines: DraftLine[];
}

const NEGATIVE_SIGNS = new Set(["-", "−"]);
const IN_PARENTHESES = /^\((.*)\)$/;

/**
 * A signed peso amount in centavos: "-150.00", "−150.00" and "(150.00)" are
 * money out. `toCentavos` takes the unsigned part, so this only reads the sign
 * the user typed; it never works out an amount. Null when it isn't a number.
 */
export function signedCentavos(value: string): number | null {
  let text = value.trim();
  let negative = false;

  const bracketed = IN_PARENTHESES.exec(text);
  if (bracketed) {
    negative = true;
    text = bracketed[1].trim();
  } else if (NEGATIVE_SIGNS.has(text.charAt(0))) {
    negative = true;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }

  const magnitude = toCentavos(text);
  if (magnitude === null) return null;
  return negative ? -magnitude : magnitude;
}

export function isBlankLine(line: DraftLine): boolean {
  return !line.date.trim() && !line.description.trim() && !line.amount.trim() && !line.reference.trim();
}

const HEADER_CELL = /^date$/i;
const ROW_SHAPE = "expected a date, a description, an amount and an optional reference.";

/**
 * Rows pasted from a statement: tab-separated (as a spreadsheet copies them)
 * or comma-separated with quotes. Blank rows and a header row are skipped.
 */
export function parsePastedLines(text: string): { lines: DraftLine[]; errors: string[] } {
  const delimiter = text.includes("\t") ? "\t" : ",";
  const records = parseCsv(text, { delimiter, skipEmptyLines: true }).filter((record) =>
    record.fields.some((field) => field.trim()),
  );

  const lines: DraftLine[] = [];
  const errors: string[] = [];

  records.forEach((record, index) => {
    const [date = "", description = "", amount = "", reference = ""] = record.fields.map((f) => f.trim());
    if (index === 0 && HEADER_CELL.test(date)) return;
    if (!date || !description || !amount) {
      errors.push(`Pasted row ${record.line}: ${ROW_SHAPE}`);
      return;
    }
    lines.push({ date, description, amount, reference });
  });

  return { lines, errors };
}

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function lineErrors(line: DraftLine, label: string): string[] {
  const errors: string[] = [];
  const description = line.description.trim();
  const amount = signedCentavos(line.amount);

  if (!ISO_DATE.test(line.date.trim())) errors.push(`${label}: enter the date as YYYY-MM-DD.`);
  if (!description) errors.push(`${label}: enter a description.`);
  if (description.length > DESCRIPTION_MAX) {
    errors.push(`${label}: the description can be at most ${DESCRIPTION_MAX} characters.`);
  }
  if (amount === null) errors.push(`${label}: enter the amount in pesos; money out is negative.`);
  if (amount === 0) errors.push(`${label}: the amount can't be zero.`);
  if (line.reference.trim().length > REFERENCE_MAX) {
    errors.push(`${label}: the reference can be at most ${REFERENCE_MAX} characters.`);
  }
  return errors;
}

function toNewLine(line: DraftLine): NewStatementLine {
  const reference = line.reference.trim();
  return {
    date: line.date.trim(),
    description: line.description.trim(),
    amount: signedCentavos(line.amount) ?? 0,
    ...(reference ? { external_reference: reference } : {}),
  };
}

export type CreateBodyResult =
  | { ok: true; body: CreateReconciliationBody }
  | { ok: false; errors: string[] };

export function buildCreateBody(form: StatementForm): CreateBodyResult {
  const errors: string[] = [];
  const period = form.period.trim();
  const statementBalance = signedCentavos(form.statementBalance);
  const lines = form.lines.filter((line) => !isBlankLine(line));

  if (form.accountId === null) errors.push("Choose the money account.");
  if (period.length > PERIOD_MAX) errors.push(`The period can be at most ${PERIOD_MAX} characters.`);
  if (!form.startDate || !form.endDate) {
    errors.push("Enter the start and end dates.");
  } else if (form.endDate < form.startDate) {
    errors.push("The end date can't be before the start date.");
  }
  if (statementBalance === null) {
    errors.push("Enter the statement closing balance in pesos, for example 24,850.50 or -1,500.00.");
  }
  if (lines.length > STATEMENT_LINES_MAX) {
    errors.push("A statement can have at most 1,000 lines.");
  } else {
    lines.forEach((line, index) => errors.push(...lineErrors(line, `Line ${index + 1}`)));
  }

  if (errors.length > 0 || form.accountId === null || statementBalance === null) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    body: {
      account_id: form.accountId,
      ...(period ? { period } : {}),
      start_date: form.startDate,
      end_date: form.endDate,
      statement_balance: statementBalance,
      lines: lines.map(toNewLine),
    },
  };
}

const LINE_FIELD = /^lines\.(\d+)\./;

/** The server's 422s on create, each line's named by its number on screen. */
export function createErrorMessages(err: unknown, { canViewAll }: { canViewAll: boolean }): string[] {
  const status = httpStatusOf(err);
  if (status === 403 && !canViewAll) return [BRANCH_ACCESS_EXPLANATION];

  const errors = (err as { response?: { data?: { errors?: Record<string, string[]> } } })?.response
    ?.data?.errors;
  if (status !== 422 || !errors) return [getErrorMessage(err)];

  return Object.entries(errors).flatMap(([field, messages]) => {
    const line = LINE_FIELD.exec(field);
    const prefix = line ? `Line ${Number(line[1]) + 1}: ` : "";
    return messages.map((message) => `${prefix}${message}`);
  });
}
