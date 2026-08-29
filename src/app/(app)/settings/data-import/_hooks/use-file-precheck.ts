"use client";

/**
 * The browser-side pre-check for the migration CSVs.
 *
 * Runs BEFORE a byte is uploaded, so the admin finds out about a wrong
 * delimiter, a header row they were told to delete, or an unreadable date
 * column while the fix is still "re-export the sheet" rather than "we imported
 * four thousand loans against the wrong maturity dates".
 *
 * Three rules hold this module together, and each of them is here because the
 * obvious alternative is silently wrong:
 *
 *  1. **Reading goes through `readCsvFile`, always.** It owns the single
 *     streaming `TextDecoder`. Slicing the file and calling `.text()` on each
 *     slice decodes every slice independently, so any character whose bytes
 *     straddle a cut comes back as U+FFFD — and the parse still reports the
 *     right number of rows, each the right width, with no error anywhere. On
 *     Philippine member data that lands on `ñ`: Peña, Muñoz, Santo Niño. The
 *     only symptom is a misspelled name found months later by a human.
 *
 *  2. **Detection is reported, not applied silently.** Every verdict below
 *     carries its evidence — which cell proved the date order, which labels
 *     made record 0 a header, which delimiter was found and from how many
 *     sampled rows. A pre-check the admin cannot audit is a pre-check that is
 *     believed when it is wrong.
 *
 *  3. **Warnings never enter a failure total.** `blockingSizeProblems` exists
 *     for exactly this; a contact cell holding two numbers is repaired by the
 *     server, and counting it as a failure tells an admin their data is broken
 *     when it is not, on the one screen whose whole job is to be believed.
 *
 * Nothing here calls the server. That is deliberate: the pre-check must work on
 * a file that has not been uploaded, and it must never be the thing that
 * decides whether an upload may begin on evidence only the server holds.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DELIMITER_LABELS,
  type CsvDelimiter,
  type CsvRecord,
} from "@/lib/csv-parse";
import { readCsvFile, type CsvFileNotice } from "@/lib/csv-read";
import {
  blockingSizeProblems,
  columnsFor,
  detectHeaderRow,
  fieldSizeProblems,
  identifyShape,
  missingRequiredFields,
  normaliseRow,
  resolveRowEnums,
  type FieldSizeProblem,
  type HeaderDetection,
  type ImportColumn,
  type ImportShape,
  type ShapeGuess,
} from "@/lib/import-schema";
import {
  inferDateFormat,
  parseImportDate,
  type DateFormatInference,
  type DateOrder,
} from "@/lib/import-date";
import { formatCount } from "@/lib/report-format";
import type { ImportFileKind, ImportIssueSeverity } from "@/types/data-import";

// ---------------------------------------------------------------------------
// Ceilings
// ---------------------------------------------------------------------------

/**
 * How many data rows the per-row checks visit.
 *
 * Measured, not guessed: one row costs ~5.5 µs through `normaliseRow` →
 * `resolveRowEnums` → `missingRequiredFields` → `fieldSizeProblems` → date
 * parse, so 20,000 rows is ~125 ms — one visible beat, not a frozen tab. The
 * ceiling is a RESPONSIVENESS budget and nothing else, so anything above it is
 * announced (`rowsNotChecked`) rather than dropped. Quietly checking the first
 * N and reporting "no problems found" is the failure this number exists to
 * avoid.
 */
export const ROW_CHECK_CEILING = 20_000;

/**
 * How many individual issues are kept for display.
 *
 * The COUNTS (`errorCount`, `warningCount`, `failingRows`) are always exact
 * over every checked row — only the list of examples is capped, and
 * `issuesTruncated` says so. Capping the counts alongside the list is how a
 * screen ends up reporting "500 problems" for a file with fifty thousand.
 */
export const ISSUE_LIST_CAP = 500;

/** Options quoted back when a closed vocabulary does not match. */
const OPTION_QUOTE_LIMIT = 6;

/** Records sampled when deciding which file a headerless CSV belongs to. */
const SLOT_SAMPLE_ROWS = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** `ImportFileKind` is plural, `ImportShape` is not. Kept in one place. */
const SHAPE_BY_KIND: Record<ImportFileKind, ImportShape> = {
  customers: "customer",
  loans: "loans",
};

const FILE_LABELS: Record<ImportFileKind, string> = {
  customers: "Customer Profile",
  loans: "Loans",
};

export type PrecheckCategory =
  | "columns"
  | "required"
  | "value"
  | "size"
  | "date"
  | "duplicate"
  | "cross-file";

export interface PrecheckIssue {
  /** Stable across recomputes, for React keys. */
  id: string;
  kind: ImportFileKind;
  /** Physical line, as the admin's spreadsheet numbers it. */
  line: number;
  /** The row's own identifier — account no. or loan no. Blank when missing. */
  reference: string;
  /** Column label, or `null` when the problem is the whole row. */
  column: string | null;
  /**
   * `error`   the row will not import as it stands.
   * `warning` the row imports; something about it is worth knowing.
   *
   * Same vocabulary as the server's `ImportRowIssue`, so a pre-check issue and
   * the error report it later becomes read the same way.
   */
  severity: ImportIssueSeverity;
  category: PrecheckCategory;
  message: string;
  /** The cell exactly as it appears in the file. */
  value: string | null;
}

/** What one file turned out to be, before any admin override is applied. */
export interface FileInspection {
  kind: ImportFileKind;
  shape: ImportShape;
  label: string;
  fileName: string;
  sizeBytes: number;
  /** The delimiter records were actually parsed with. */
  delimiter: string;
  /** "comma" | "semicolon" | "tab", or the character when it is none of those. */
  delimiterLabel: string;
  /** False means no delimiter was found and the comma is a fallback. */
  delimiterDetected: boolean;
  /** Rows the delimiter sniff looked at — 0 or 1 means the pick rests on little. */
  delimiterRows: number;
  /** File-level notices from the read: bad encoding, unbalanced quote. */
  notices: CsvFileNotice[];
  /** Everything the complete parse produced, header row included. */
  records: CsvRecord[];
  expectedColumns: number;
  /** Run on record 0. `null` for a file with no records at all. */
  header: HeaderDetection | null;
  /** Record 0 as it appears, for the override to quote back. */
  headerFields: readonly string[] | null;
  /** Which of the two files this one looks like — the wrong-slot check. */
  slot: ShapeGuess | null;
  /** Row widths across the whole file, commonest first. */
  widths: Array<{ columns: number; rows: number }>;
}

/** One date column's verdict, plus whatever the admin decided about it. */
export interface DateColumnFinding {
  key: string;
  label: string;
  inference: DateFormatInference;
  /**
   * How the column will be read.
   * `"dmy" | "mdy"` settled; `null` no order needed (ISO and/or serials only);
   * `undefined` NOT settled — the admin still has to choose.
   */
  order: DateOrder | null | undefined;
  /** True when the admin chose it rather than the file proving it. */
  chosen: boolean;
  /** Unusable at any setting. The file has to be fixed and re-exported. */
  blocked: boolean;
}

export interface FileFindings {
  kind: ImportFileKind;
  /** Data rows in the file, from the COMPLETE parse. Never a checked subset. */
  totalRows: number;
  /** Data rows the per-row checks actually visited. */
  checkedRows: number;
  /** `totalRows - checkedRows`. Above zero, say so on screen. */
  rowsNotChecked: number;
  /** Date columns are inferred over EVERY row, never the checked subset. */
  dates: DateColumnFinding[];
  /** Capped at `ISSUE_LIST_CAP`; the counts beside it are not. */
  issues: PrecheckIssue[];
  issuesTruncated: boolean;
  errorCount: number;
  warningCount: number;
  /** Rows carrying at least one error — the number that will fail on import. */
  failingRows: number;
  /** Reasons this file must not be imported at all, ready to display. */
  blockers: string[];
  /** Decisions only the admin can make. Also holds up the import. */
  pendingDecisions: string[];
}

export interface PrecheckProgress {
  kind: ImportFileKind;
  fileName: string;
  /** 0–1. */
  ratio: number;
  records: number;
}

export type PrecheckStatus = "idle" | "reading" | "checking" | "ready" | "failed";

export interface UseFilePrecheckResult {
  status: PrecheckStatus;
  progress: PrecheckProgress | null;
  /** Set when the read itself failed — not when the DATA is bad. */
  error: string | null;
  inspections: Partial<Record<ImportFileKind, FileInspection>>;
  findings: Partial<Record<ImportFileKind, FileFindings>>;
  /** Whether row 1 is treated as a header. Defaults to what was detected. */
  skipHeader: (kind: ImportFileKind) => boolean;
  setSkipHeader: (kind: ImportFileKind, skip: boolean) => void;
  /** True once the admin has moved the header switch off the detected value. */
  headerOverridden: (kind: ImportFileKind) => boolean;
  setDateOrder: (kind: ImportFileKind, column: string, order: DateOrder) => void;
  /** Every file's blockers, flattened. Non-empty means the import cannot run. */
  blockers: string[];
  /** Every file's outstanding admin decisions, flattened. */
  pendingDecisions: string[];
  /** Exact over the checked rows of every file. Errors only — never warnings. */
  totalErrors: number;
  totalWarnings: number;
  totalFailingRows: number;
  /** Re-read the files from disk. For the "try again" on a read failure. */
  retry: () => void;
}

// ---------------------------------------------------------------------------
// Inspection — what the file IS
// ---------------------------------------------------------------------------

function delimiterWords(delimiter: string): string {
  return (
    DELIMITER_LABELS[delimiter as CsvDelimiter] ??
    (delimiter === "\t" ? "tab" : `"${delimiter}"`)
  );
}

/**
 * Which of the two files does this one look like?
 *
 * A header row settles it on its labels alone. Without one, a single data row
 * is thin evidence — a customer row missing its email scores no better than a
 * loans row — so up to five are polled and the majority wins. Wrong-slot is a
 * hard blocker, and a hard blocker raised on one row would stop a good import.
 */
function guessSlot(records: readonly CsvRecord[], headerPresent: boolean): ShapeGuess | null {
  if (records.length === 0) return null;
  if (headerPresent) return identifyShape(records[0].fields);

  const sample = records.slice(0, SLOT_SAMPLE_ROWS).map((r) => identifyShape(r.fields));
  const votes = { customer: 0, loans: 0 };
  for (const guess of sample) if (guess.shape) votes[guess.shape] += 1;

  const winner =
    votes.customer === votes.loans ? null : votes.customer > votes.loans ? "customer" : "loans";
  const first = sample[0];
  return {
    shape: winner,
    customerScore: first.customerScore,
    loansScore: first.loansScore,
    basis: first.basis,
  };
}

function widthHistogram(records: readonly CsvRecord[]): Array<{ columns: number; rows: number }> {
  const counts = new Map<number, number>();
  for (const record of records) {
    counts.set(record.fields.length, (counts.get(record.fields.length) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([columns, rows]) => ({ columns, rows }))
    .sort((a, b) => b.rows - a.rows || a.columns - b.columns);
}

/**
 * Read one file and describe it. The only function here that touches a `File`.
 *
 * No `delimiter` is passed on purpose: `readCsvFile` sniffs it and reports what
 * it found, which is what keeps the delimiter used for parsing and the
 * delimiter shown on screen from ever disagreeing.
 */
export async function inspectFile(
  kind: ImportFileKind,
  file: File,
  options: { signal?: AbortSignal; onProgress?: (progress: PrecheckProgress) => void } = {},
): Promise<FileInspection> {
  const shape = SHAPE_BY_KIND[kind];
  const result = await readCsvFile(file, {
    signal: options.signal,
    onProgress: ({ ratio, records }) =>
      options.onProgress?.({ kind, fileName: file.name, ratio, records }),
  });

  const header = result.records.length > 0 ? detectHeaderRow(result.records[0].fields, shape) : null;

  return {
    kind,
    shape,
    label: FILE_LABELS[kind],
    fileName: file.name,
    sizeBytes: file.size,
    delimiter: result.delimiter,
    delimiterLabel: result.sniff?.label ?? delimiterWords(result.delimiter),
    delimiterDetected: result.sniff?.detected ?? false,
    delimiterRows: result.sniff?.rows ?? 0,
    notices: result.notices,
    records: result.records,
    expectedColumns: columnsFor(shape).length,
    header,
    headerFields: result.records[0]?.fields ?? null,
    slot: guessSlot(result.records, header?.isHeader ?? false),
    widths: widthHistogram(result.records),
  };
}

// ---------------------------------------------------------------------------
// Findings — what the file MEANS, given the admin's overrides
// ---------------------------------------------------------------------------

function dataRecords(inspection: FileInspection, skipHeader: boolean): CsvRecord[] {
  return skipHeader ? inspection.records.slice(1) : inspection.records;
}

function dateColumns(shape: ImportShape): ImportColumn[] {
  return columnsFor(shape).filter((column) => column.type === "date");
}

/** The column that names the row in a message: the account, or the loan. */
function identityColumn(shape: ImportShape): ImportColumn {
  const key = shape === "customer" ? "account_no" : "loan_no";
  // Present in both tables by construction; the find is for type narrowing.
  return columnsFor(shape).find((column) => column.key === key) ?? columnsFor(shape)[0];
}

/**
 * Settle every date column in a file.
 *
 * Inference runs over EVERY data row, not the `ROW_CHECK_CEILING` subset. The
 * order chosen here is applied to all of them at upload, so evidence from row
 * 40,000 — a `31/07/2019` that proves day-first, or a second reading that makes
 * the column conflicted — has to be able to reach the verdict. This is the one
 * place in the pre-check where completeness outranks speed, and it is the one
 * that costs a whole loan book when it is wrong.
 */
function settleDates(
  inspection: FileInspection,
  rows: readonly CsvRecord[],
  chosen: Readonly<Partial<Record<string, DateOrder>>>,
): DateColumnFinding[] {
  const columns = columnsFor(inspection.shape);
  return dateColumns(inspection.shape).map((column) => {
    const index = columns.indexOf(column);
    const values = rows.map((row) => String(row.fields[index] ?? ""));
    const inference = inferDateFormat(values);
    const pick = chosen[column.key];

    if (inference.status === "resolved") {
      return { key: column.key, label: column.label, inference, order: inference.order, chosen: false, blocked: false };
    }
    if (inference.status === "ambiguous") {
      return {
        key: column.key,
        label: column.label,
        inference,
        order: pick,
        chosen: pick !== undefined,
        blocked: false,
      };
    }
    if (inference.status === "empty") {
      // Nothing to read either way. Not a decision, and not a fault.
      return { key: column.key, label: column.label, inference, order: null, chosen: false, blocked: false };
    }
    // conflicted | unusable — no order can rescue this column.
    return { key: column.key, label: column.label, inference, order: undefined, chosen: false, blocked: true };
  });
}

function quoteOptions(options: readonly { label: string }[]): string {
  const shown = options.slice(0, OPTION_QUOTE_LIMIT).map((option) => option.label);
  return options.length > OPTION_QUOTE_LIMIT ? `${shown.join(", ")}, …` : shown.join(", ");
}

function sizeMessage(problem: FieldSizeProblem): string {
  switch (problem.reason) {
    case "too-long":
      return `${problem.label} is ${problem.raw.length} characters; this field holds ${problem.limit}.`;
    case "too-large":
      return `${problem.label} is larger than this field can store (limit ${problem.limit}).`;
    case "too-precise":
      return `${problem.label} has more decimal places than this field stores (${problem.limit}).`;
    case "not-a-number":
      return `${problem.label} is "${problem.raw}", which is not a number.`;
    case "multiple-values":
      // `kept` is the server's own predicted output, so an empty one means the
      // cell had no digits at all and this is not really "two numbers" — it is
      // `N/A` being split on its slash. Saying "the import keeps  and drops A"
      // is worse than useless, and calling it a clean repair on a REQUIRED
      // field would be a false reassurance. It stays a warning rather than
      // becoming an error because whether the server validates before or after
      // it normalises is not knowable from here, and an unproven failure must
      // not be counted as one.
      if (!problem.kept) {
        return `${problem.label} is "${problem.raw}", which has no digits in it. The import keeps only the first number in a cell, so this field would be stored empty — and it is required.`;
      }
      // A warning, and the copy has to earn that: say what the import will do,
      // so the admin can decide whether losing the second number matters
      // instead of hand-editing a file that would have imported fine.
      return `${problem.label} holds more than one number. The import keeps ${problem.kept}${
        problem.dropped?.length ? ` and drops ${problem.dropped.join(", ")}` : ""
      }.`;
  }
}

function dateMessage(label: string, raw: string, reason: string, order: DateOrder | null | undefined): string {
  switch (reason) {
    case "impossible": {
      const reading = order === "dmy" ? " read day-first" : order === "mdy" ? " read month-first" : "";
      return `${label} "${raw}" is not a real date${reading}.`;
    }
    case "two-digit-year":
      return `${label} "${raw}" has a two-digit year, so the century cannot be known. Write the year in full.`;
    case "unrecognised":
      return `${label} "${raw}" is not a date.`;
    default:
      return `${label} "${raw}" could not be read as a date.`;
  }
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * `1975-04-03` → `3 April 1975`, straight off the string.
 *
 * Deliberately NOT `formatDate`/`formatDateLong`, which go through
 * `new Date(iso)`. That parses a bare `YYYY-MM-DD` as UTC midnight, so anywhere
 * west of UTC it renders the previous day — and the one screen where that must
 * never happen is the one asking an admin to choose between 3 April and 4
 * March. Manila (UTC+8) would look fine and hide it; a laptop still set to a US
 * timezone would silently show the wrong answer to the question being asked.
 * Splitting the string cannot be wrong in any timezone.
 */
export function describeIsoDate(iso: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!parts) return iso;
  const month = MONTH_NAMES[Number(parts[2]) - 1];
  return month ? `${Number(parts[3])} ${month} ${parts[1]}` : iso;
}

interface RowCheckContext {
  kind: ImportFileKind;
  shape: ImportShape;
  dates: readonly DateColumnFinding[];
  /** Account numbers from the customers file, or `null` when it was not read. */
  knownAccounts: ReadonlySet<string> | null;
  expectedColumns: number;
}

interface RowCheckTotals {
  issues: PrecheckIssue[];
  issuesTruncated: boolean;
  errorCount: number;
  warningCount: number;
  failingRows: number;
}

/**
 * Every per-row check, in one pass over the data rows.
 *
 * Pure and exported so it can be unit-tested without a DOM or a `File`.
 *
 * Two things are deliberately NOT errors here:
 *  - a loans row whose account number is absent from the customers file. The
 *    coop already has 44 self-registered members who exist server-side and are
 *    not in the migration sheet, and the client cannot replicate the server's
 *    matching. Calling it an error would send an admin to "fix" rows that are
 *    already correct.
 *  - anything `fieldSizeProblems` marks `warning`. The severity is decided
 *    there, by what the SERVER will do with the value, and re-deciding it at
 *    the call site is how a repairable value lands in a failure total.
 */
export function checkRows(
  rows: readonly CsvRecord[],
  context: RowCheckContext,
  issueCap: number = ISSUE_LIST_CAP,
): RowCheckTotals {
  const columns = columnsFor(context.shape);
  const identity = identityColumn(context.shape);
  const identityIndex = columns.indexOf(identity);
  const accountIndex = columns.findIndex((column) => column.key === "account_no");
  const dateIndex = new Map(context.dates.map((date) => [date.key, columns.findIndex((c) => c.key === date.key)]));

  const totals: RowCheckTotals = {
    issues: [],
    issuesTruncated: false,
    errorCount: 0,
    warningCount: 0,
    failingRows: 0,
  };

  const firstSeenAt = new Map<string, number>();
  let sequence = 0;
  let rowHasError = false;

  const add = (
    line: number,
    reference: string,
    issue: Omit<PrecheckIssue, "id" | "kind" | "line" | "reference">,
  ) => {
    if (issue.severity === "error") {
      totals.errorCount += 1;
      rowHasError = true;
    } else {
      totals.warningCount += 1;
    }
    // Counts above are exact; only the LIST is capped. A capped count would
    // report "500 problems" for a file with fifty thousand of them.
    if (totals.issues.length >= issueCap) {
      totals.issuesTruncated = true;
      return;
    }
    sequence += 1;
    totals.issues.push({
      id: `${context.kind}-${line}-${sequence}`,
      kind: context.kind,
      line,
      reference,
      ...issue,
    });
  };

  for (const record of rows) {
    rowHasError = false;
    const { line, fields } = record;
    const reference = String(fields[identityIndex] ?? "").trim();

    if (fields.length !== context.expectedColumns) {
      add(line, reference, {
        column: null,
        severity: "error",
        category: "columns",
        message: `This row has ${fields.length} ${
          fields.length === 1 ? "column" : "columns"
        }; the ${context.shape === "customer" ? "Customer Profile" : "Loans"} file needs ${
          context.expectedColumns
        }. Every value after the gap lines up with the wrong field.`,
        value: null,
      });
    }

    const raw = normaliseRow(fields, context.shape);
    const { row, unknown } = resolveRowEnums(raw, context.shape);

    for (const bad of unknown) {
      add(line, reference, {
        column: bad.label,
        severity: "error",
        category: "value",
        message: `"${bad.raw}" is not a value ${bad.label} accepts. Expected one of: ${quoteOptions(bad.options)}.`,
        value: bad.raw,
      });
    }

    for (const label of missingRequiredFields(row, context.shape)) {
      add(line, reference, {
        column: label,
        severity: "error",
        category: "required",
        message: `${label} is blank, and this row cannot be imported without it.`,
        value: null,
      });
    }

    // Severity comes from `blockingSizeProblems`, never from re-reading
    // `problem.severity` here. Deciding it at the call site is precisely how a
    // value the server repairs ends up inside a failure total.
    const sizeProblems = fieldSizeProblems(row, context.shape);
    const blocking = new Set<FieldSizeProblem>(blockingSizeProblems(sizeProblems));
    for (const problem of sizeProblems) {
      add(line, reference, {
        column: problem.label,
        severity: blocking.has(problem) ? "error" : "warning",
        category: "size",
        message: sizeMessage(problem),
        value: problem.raw,
      });
    }

    for (const date of context.dates) {
      // A blocked column is reported once, for the whole file, in `blockers`.
      // A column still waiting on the admin is not judged at all yet: parsing
      // it under a guessed order is the exact mistake this screen prevents.
      if (date.blocked || date.order === undefined) continue;
      const index = dateIndex.get(date.key) ?? -1;
      const cell = String(fields[index] ?? "").trim();
      if (!cell) continue; // Blank is `missingRequiredFields`' question.
      const parsed = parseImportDate(cell, date.order);
      if (parsed.ok) continue;
      add(line, reference, {
        column: date.label,
        severity: "error",
        category: "date",
        message: dateMessage(date.label, cell, parsed.reason, date.order),
        value: cell,
      });
    }

    if (reference) {
      const seen = firstSeenAt.get(reference);
      if (seen === undefined) firstSeenAt.set(reference, line);
      else {
        add(line, reference, {
          column: identity.label,
          severity: "warning",
          category: "duplicate",
          message: `${identity.label} ${reference} is already on line ${seen}. Both rows describe the same record, so only one version of these details can land.`,
          value: reference,
        });
      }
    }

    if (context.knownAccounts && accountIndex >= 0 && context.shape === "loans") {
      const account = String(fields[accountIndex] ?? "").trim();
      if (account && !context.knownAccounts.has(account)) {
        add(line, reference, {
          column: "Account No.",
          severity: "warning",
          category: "cross-file",
          message: `No member with Account No. ${account} is in the customers file. Members who already exist in Lendyph are matched on the server, so this loan can still land — but if they do not exist, this row will fail.`,
          value: account,
        });
      }
    }

    if (rowHasError) totals.failingRows += 1;
  }

  return totals;
}

/** Account numbers across the WHOLE customers file, header row included or not. */
export function accountNumbersIn(inspection: FileInspection, skipHeader: boolean): Set<string> {
  const index = columnsFor(inspection.shape).findIndex((column) => column.key === "account_no");
  const accounts = new Set<string>();
  if (index < 0) return accounts;
  for (const record of dataRecords(inspection, skipHeader)) {
    const value = String(record.fields[index] ?? "").trim();
    if (value) accounts.add(value);
  }
  return accounts;
}

/**
 * Everything that stops this file being imported at all.
 *
 * Distinct from a row failing: a bad row is reported, imported around, and
 * lands in the error report. These are conditions where the whole file means
 * something other than what it appears to, so importing it would write the
 * wrong data rather than less data.
 */
export function fileBlockers(
  inspection: FileInspection,
  rows: readonly CsvRecord[],
  dates: readonly DateColumnFinding[],
): string[] {
  const blockers: string[] = [];

  for (const notice of inspection.notices) {
    if (notice.severity === "error") blockers.push(notice.message);
  }

  if (rows.length === 0) {
    blockers.push(
      inspection.records.length === 0
        ? "No rows were found in this file."
        : "The only row in this file is the header row, so there is nothing to import.",
    );
  }

  const wrongSlot = inspection.slot?.shape && inspection.slot.shape !== inspection.shape;
  if (wrongSlot) {
    blockers.push(
      `This looks like the ${
        inspection.slot?.shape === "customer" ? "Customer Profile" : "Loans"
      } file, but it was chosen as the ${inspection.label} file. Importing it here would write each value into the wrong field.`,
    );
  }

  // The commonest width IS the file's shape. A handful of ragged rows is a row
  // problem; a whole file at the wrong width is a different file.
  const modal = inspection.widths[0];
  if (!wrongSlot && modal && rows.length > 0 && modal.columns !== inspection.expectedColumns) {
    blockers.push(
      `Most rows have ${modal.columns} columns, but the ${inspection.label} file needs ${inspection.expectedColumns}. Check the file was exported whole and that no columns were added or removed.`,
    );
  }

  for (const date of dates) {
    if (!date.blocked) continue;
    if (date.inference.status === "conflicted") {
      blockers.push(
        `${date.label} contains dates written both ways — ${date.inference.dmyEvidence} can only be day-first and ${date.inference.mdyEvidence} can only be month-first. No single setting reads this column correctly, so it has to be fixed in the file.`,
      );
    } else {
      blockers.push(
        `${date.label} holds no readable dates. ${describeUnusable(date.inference)}`,
      );
    }
  }

  return blockers;
}

function describeUnusable(inference: DateFormatInference): string {
  const stats = inference.stats;
  const bits: string[] = [];
  if (stats.shortYear > 0) {
    bits.push(`${formatCount(stats.shortYear)} have a two-digit year (${stats.shortYearSamples.join(", ")})`);
  }
  if (stats.invalid > 0) {
    bits.push(`${formatCount(stats.invalid)} are not real dates (${stats.invalidSamples.join(", ")})`);
  }
  if (stats.unrecognised > 0) {
    bits.push(`${formatCount(stats.unrecognised)} are not dates at all (${stats.unrecognisedSamples.join(", ")})`);
  }
  return bits.length > 0 ? `Of ${formatCount(stats.total)} values, ${bits.join("; ")}.` : "";
}

function pendingFor(dates: readonly DateColumnFinding[]): string[] {
  return dates
    .filter((date) => date.inference.status === "ambiguous" && date.order === undefined)
    .map(
      (date) =>
        `${date.label}: every date in this column reads both ways. Choose day-first or month-first before continuing.`,
    );
}

/**
 * Turn inspections plus overrides into findings. Pure, and the whole cost of a
 * pre-check — the caller runs it off the render path.
 */
export function computeFindings(
  inspections: Partial<Record<ImportFileKind, FileInspection>>,
  skipHeader: Partial<Record<ImportFileKind, boolean>>,
  dateChoices: Partial<Record<ImportFileKind, Record<string, DateOrder>>>,
  rowCeiling: number = ROW_CHECK_CEILING,
): Partial<Record<ImportFileKind, FileFindings>> {
  const customers = inspections.customers;
  const knownAccounts = customers
    ? accountNumbersIn(customers, skipHeader.customers ?? customers.header?.isHeader ?? false)
    : null;

  const findings: Partial<Record<ImportFileKind, FileFindings>> = {};

  for (const kind of ["customers", "loans"] as const) {
    const inspection = inspections[kind];
    if (!inspection) continue;

    const skip = skipHeader[kind] ?? inspection.header?.isHeader ?? false;
    const rows = dataRecords(inspection, skip);
    const dates = settleDates(inspection, rows, dateChoices[kind] ?? {});
    const checked = rows.slice(0, rowCeiling);

    const totals = checkRows(checked, {
      kind,
      shape: inspection.shape,
      dates,
      knownAccounts: kind === "loans" ? knownAccounts : null,
      expectedColumns: inspection.expectedColumns,
    });

    findings[kind] = {
      kind,
      totalRows: rows.length,
      checkedRows: checked.length,
      rowsNotChecked: rows.length - checked.length,
      dates,
      ...totals,
      blockers: fileBlockers(inspection, rows, dates),
      pendingDecisions: pendingFor(dates),
    };
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Collapsing the answers into what the session record can hold
// ---------------------------------------------------------------------------

/** `ImportSession.dateFormat` is one string. These are the three it can be. */
export const DATE_FORMAT_PATTERNS: Record<DateOrder, string> = {
  dmy: "dd/MM/yyyy",
  mdy: "MM/dd/yyyy",
};

/** What a column of ISO dates and/or Excel serials is written as. */
export const ISO_DATE_FORMAT = "yyyy-MM-dd";

/** The per-file answers, in the only shape this collapse needs to see. */
export interface CollapsibleFileAnswer {
  /** For the message when two files disagree. */
  label: string;
  skipHeaderRow: boolean;
  /** Per date column. `null` = the column needs no order. */
  dateOrders: Readonly<Record<string, DateOrder | null>>;
}

export interface CollapsedAnswers {
  hasHeaderRow: boolean;
  dateFormat: string;
  /**
   * What the collapse could not carry. Empty in the ordinary case.
   *
   * NOT an error and NOT a blocker: the current pass uploads from the per-file
   * answers, which are exact. This is what a RESUME after a reload would have
   * to re-ask, and the admin is told rather than left to find out.
   */
  losses: string[];
}

/**
 * Squeeze the per-file, per-column answers into `ImportSession`'s single
 * `hasHeaderRow` and single `dateFormat`.
 *
 * This function exists because that record is narrower than the truth, and the
 * narrowing is worth naming rather than hiding:
 *
 *  - the SERVER models header-skipping per file — see
 *    `ImportFileStatus.staging.header_skipped` on the contract — and one file
 *    routinely has a header row while the other does not, because the client's
 *    spec tells coops to delete it and they delete it from one sheet;
 *  - date order is settled per COLUMN, and a file can genuinely prove day-first
 *    in one column and month-first in another.
 *
 * So it reports what it had to drop instead of silently picking. Nothing here
 * guesses in silence, which is the same rule the date inference follows.
 */
export function collapseForSession(
  answers: readonly CollapsibleFileAnswer[],
): CollapsedAnswers {
  const losses: string[] = [];

  const skipping = answers.filter((answer) => answer.skipHeaderRow);
  const hasHeaderRow = skipping.length > 0;
  if (skipping.length > 0 && skipping.length < answers.length) {
    const without = answers.filter((answer) => !answer.skipHeaderRow).map((a) => a.label);
    losses.push(
      `${skipping
        .map((a) => a.label)
        .join(" and ")} ${skipping.length === 1 ? "has" : "have"} a header row and ${without.join(
        " and ",
      )} ${without.length === 1 ? "does" : "do"} not. This import handles each file correctly, but the saved session remembers only one setting — if you close the tab and resume, check the header setting again before uploading.`,
    );
  }

  const orders = new Set<DateOrder>();
  for (const answer of answers) {
    for (const order of Object.values(answer.dateOrders)) {
      if (order) orders.add(order);
    }
  }
  const [first, ...rest] = [...orders];
  const dateFormat = first ? DATE_FORMAT_PATTERNS[first] : ISO_DATE_FORMAT;
  if (rest.length > 0) {
    losses.push(
      `Your files use more than one date order (${[...orders]
        .map((order) => DATE_FORMAT_PATTERNS[order])
        .join(" and ")}). Each column is read correctly now, but the saved session remembers only ${dateFormat} — if you resume after closing the tab, confirm the dates again.`,
    );
  }

  return { hasHeaderRow, dateFormat, losses };
}

// ---------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------

/** Progress is reported ~640 times for a 40 MB file. Throttle it or the UI dies. */
const PROGRESS_INTERVAL_MS = 100;

function readFailureMessage(error: unknown, fileName: string): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `${fileName} could not be read: ${detail}. If the file is open in Excel, close it and choose it again.`;
}

/**
 * Read the picked files, check them, and hold the admin's overrides.
 *
 * `files` is read on identity, so the caller must hold the `File` objects
 * steady — a fresh object literal every render re-reads both files. A slot may
 * be `null` as well as absent: a shell that clears a slot sets it to `null`,
 * and the two mean the same thing here.
 */
export function useFilePrecheck(
  files: Partial<Record<ImportFileKind, File | null | undefined>>,
): UseFilePrecheckResult {
  const [inspections, setInspections] = useState<Partial<Record<ImportFileKind, FileInspection>>>({});
  const [findings, setFindings] = useState<Partial<Record<ImportFileKind, FileFindings>>>({});
  const [reading, setReading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [progress, setProgress] = useState<PrecheckProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [skipHeaderState, setSkipHeaderState] = useState<Partial<Record<ImportFileKind, boolean>>>({});
  const [dateChoices, setDateChoices] = useState<Partial<Record<ImportFileKind, Record<string, DateOrder>>>>({});

  const customersFile = files.customers ?? null;
  const loansFile = files.loans ?? null;
  const lastProgressAt = useRef(0);

  useEffect(() => {
    const picked: Array<[ImportFileKind, File]> = [];
    if (customersFile) picked.push(["customers", customersFile]);
    if (loansFile) picked.push(["loans", loansFile]);

    // A new set of files invalidates every override made about the old ones.
    setInspections({});
    setFindings({});
    setSkipHeaderState({});
    setDateChoices({});
    setError(null);
    setProgress(null);

    if (picked.length === 0) {
      setReading(false);
      return;
    }

    const controller = new AbortController();
    setReading(true);

    void (async () => {
      const next: Partial<Record<ImportFileKind, FileInspection>> = {};
      let reachedFile = picked[0][1].name;
      try {
        for (const [kind, file] of picked) {
          reachedFile = file.name;
          next[kind] = await inspectFile(kind, file, {
            signal: controller.signal,
            onProgress: (update) => {
              const now = Date.now();
              if (update.ratio < 1 && now - lastProgressAt.current < PROGRESS_INTERVAL_MS) return;
              lastProgressAt.current = now;
              setProgress(update);
            },
          });
        }
        if (controller.signal.aborted) return;
        setInspections(next);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(readFailureMessage(cause, reachedFile));
      } finally {
        if (!controller.signal.aborted) setReading(false);
      }
    })();

    return () => controller.abort();
  }, [customersFile, loansFile, attempt]);

  // Off the render path on purpose: 20,000 rows is ~125 ms of work, and doing
  // it inside a useMemo blocks the paint that would have shown "Checking…".
  useEffect(() => {
    if (Object.keys(inspections).length === 0) {
      setFindings({});
      return;
    }
    let cancelled = false;
    setComputing(true);
    const handle = setTimeout(() => {
      const next = computeFindings(inspections, skipHeaderState, dateChoices);
      if (cancelled) return;
      setFindings(next);
      setComputing(false);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [inspections, skipHeaderState, dateChoices]);

  const skipHeader = useCallback(
    (kind: ImportFileKind) => skipHeaderState[kind] ?? inspections[kind]?.header?.isHeader ?? false,
    [skipHeaderState, inspections],
  );

  const headerOverridden = useCallback(
    (kind: ImportFileKind) => {
      const override = skipHeaderState[kind];
      if (override === undefined) return false;
      return override !== (inspections[kind]?.header?.isHeader ?? false);
    },
    [skipHeaderState, inspections],
  );

  const setSkipHeader = useCallback((kind: ImportFileKind, skip: boolean) => {
    setSkipHeaderState((prev) => ({ ...prev, [kind]: skip }));
  }, []);

  const setDateOrder = useCallback((kind: ImportFileKind, column: string, order: DateOrder) => {
    setDateChoices((prev) => ({ ...prev, [kind]: { ...(prev[kind] ?? {}), [column]: order } }));
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const list = useMemo(
    () => [findings.customers, findings.loans].filter((f): f is FileFindings => Boolean(f)),
    [findings],
  );

  const status: PrecheckStatus = error
    ? "failed"
    : reading
      ? "reading"
      : Object.keys(inspections).length === 0
        ? "idle"
        : computing || list.length === 0
          ? "checking"
          : "ready";

  return {
    status,
    progress,
    error,
    inspections,
    findings,
    skipHeader,
    setSkipHeader,
    headerOverridden,
    setDateOrder,
    blockers: list.flatMap((f) => f.blockers),
    pendingDecisions: list.flatMap((f) => f.pendingDecisions),
    totalErrors: list.reduce((sum, f) => sum + f.errorCount, 0),
    totalWarnings: list.reduce((sum, f) => sum + f.warningCount, 0),
    totalFailingRows: list.reduce((sum, f) => sum + f.failingRows, 0),
    retry,
  };
}
