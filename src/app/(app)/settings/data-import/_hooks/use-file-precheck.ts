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
import { todayISO } from "@/lib/format";
import { loanFieldProblems } from "@/lib/import-loan-fields";
import { memberFieldProblems } from "@/lib/import-member-fields";
import { shareCapitalFieldProblems, shareCapitalRepeats } from "@/lib/import-share-capital";
import {
  blockingSizeProblems,
  canonicalMemberNumber,
  columnsFor,
  detectHeaderRow,
  expectedWidthWords,
  fieldSizeProblems,
  identifyShape,
  isEarlierLayout,
  layoutWidth,
  listWords,
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
import { formatCount, formatCountOf } from "@/lib/report-format";
import type { ImportFileKind, ImportIssueSeverity } from "@/types/data-import";
import { FILE_LABELS, IMPORT_FILE_KINDS, fileNameInSentence } from "../_components/import-files";

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

/** `ImportFileKind` is plural, `ImportShape` is not. Kept in one place, and
 *  exported so a screen that has a kind but no inspection to read it off — a
 *  resumed run, where the files were never re-read — reaches the same map
 *  rather than writing a third one that agrees until someone edits it. */
export const SHAPE_BY_KIND: Record<ImportFileKind, ImportShape> = {
  customers: "customer",
  loans: "loans",
  share_capital: "share_capital",
};

/** The other way round: the file a shape is, for a wrong-slot message. */
const KIND_BY_SHAPE: Record<ImportShape, ImportFileKind> = {
  customer: "customers",
  loans: "loans",
  share_capital: "share_capital",
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
  /**
   * The width every row of this file is held to: the file's own layout
   * (today's, or the workbook's earlier one) when its commonest width is one
   * of them, else today's. See `layoutWidth`.
   */
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
 * Which of the files does this one look like?
 *
 * A header row settles it on its labels alone. Without one, a single data row
 * is thin evidence — a customer row missing its email scores no better than a
 * loans row — so up to five are polled and the majority wins (a tie names
 * none). Wrong-slot is a hard blocker, and a hard blocker raised on one row
 * would stop a good import.
 */
function guessSlot(records: readonly CsvRecord[], headerPresent: boolean): ShapeGuess | null {
  if (records.length === 0) return null;
  if (headerPresent) return identifyShape(records[0].fields);

  const sample = records.slice(0, SLOT_SAMPLE_ROWS).map((r) => identifyShape(r.fields));
  const votes: Record<ImportShape, number> = { customer: 0, loans: 0, share_capital: 0 };
  for (const guess of sample) if (guess.shape) votes[guess.shape] += 1;

  const [best, second] = (Object.entries(votes) as Array<[ImportShape, number]>).sort((a, b) => b[1] - a[1]);
  const winner = best[1] > 0 && best[1] > second[1] ? best[0] : null;
  const first = sample[0];
  return {
    shape: winner,
    customerScore: first.customerScore,
    loansScore: first.loansScore,
    shareCapitalScore: first.shareCapitalScore,
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

  const widths = widthHistogram(result.records);
  // Held to the rows' layout, as the server holds it, never to its own length.
  const header =
    result.records.length > 0
      ? detectHeaderRow(result.records[0].fields, shape, layoutWidth(shape, widths[0]?.columns))
      : null;

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
    expectedColumns: layoutWidth(shape, widths[0]?.columns),
    header,
    headerFields: result.records[0]?.fields ?? null,
    slot: guessSlot(result.records, header?.isHeader ?? false),
    widths,
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

/**
 * The column that names the row in a message: the account (a members or share
 * capital row), or the loan.
 */
function identityColumn(shape: ImportShape): ImportColumn {
  const key = shape === "loans" ? "loan_no" : "account_no";
  // Present in every table by construction; the find is for type narrowing.
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
  // Only the columns the file's own layout has: an old 22-column members file
  // has no Date Hired or Membership Date to settle, rather than two blank ones.
  const present = dateColumns(inspection.shape).filter(
    (column) => columns.indexOf(column) < inspection.expectedColumns,
  );
  return present.map((column) => {
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
      // Measured on what the server stores, which `kept` holds when it differs.
      return `${problem.label} is ${(problem.kept ?? problem.raw).length} characters; this field holds ${problem.limit}.`;
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
  /**
   * Account numbers from the customers file, for a loans or share capital
   * file, or `null` when it was not read.
   */
  knownAccounts: ReadonlySet<string> | null;
  /** The file's layout width (`FileInspection.expectedColumns`). */
  expectedColumns: number;
  /** Today in Manila, `YYYY-MM-DD`. Defaults to the real today. */
  today?: string;
  /**
   * Whether the person importing can edit members, which the membership
   * columns need on top of importing. Defaults to yes; the server decides.
   */
  membershipAllowed?: boolean;
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
 * Three things are deliberately NOT errors here:
 *  - a loans row whose account number is absent from the customers file. The
 *    coop already has 44 self-registered members who exist server-side and are
 *    not in the migration sheet, and the client cannot replicate the server's
 *    matching. Calling it an error would send an admin to "fix" rows that are
 *    already correct.
 *  - anything `fieldSizeProblems` marks `warning`. The severity is decided
 *    there, by what the SERVER will do with the value, and re-deciding it at
 *    the call site is how a repairable value lands in a failure total.
 *  - a cell the server imports blank: a member's blank one the workbook asks
 *    for (a birthdate), or a gender or civil status it doesn't recognise, and
 *    a loan's blank Purpose or Loan Product. Only the cells it refuses a row
 *    for are errors (`refusedWhenBlank`, `refusedWhenUnrecognised`).
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
  const memberNumberAt = new Map<string, number>();
  // A share capital file's own repeat rule, the server's (./import-share-capital).
  const shareCapitalRepeat = context.shape === "share_capital" ? shareCapitalRepeats() : null;
  const today = context.today ?? todayISO();
  const membershipAllowed = context.membershipAllowed ?? true;
  const fileLabel = fileNameInSentence(context.kind);
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
      const needs = isEarlierLayout(context.shape, context.expectedColumns)
        ? `this ${fileLabel} is in the earlier ${context.expectedColumns}-column layout, so every row needs ${context.expectedColumns}`
        : `the ${fileLabel} needs ${context.expectedColumns}`;
      add(line, reference, {
        column: null,
        severity: "error",
        category: "columns",
        message: `This row has ${fields.length} ${
          fields.length === 1 ? "column" : "columns"
        }; ${needs}. Every value after the gap lines up with the wrong field.`,
        value: null,
      });
    }

    const raw = normaliseRow(fields, context.shape);
    const { row, unknown } = resolveRowEnums(raw, context.shape);

    // Refused or imported blank, as the server decides (the column's markers).
    for (const bad of unknown) {
      const options = quoteOptions(bad.options);
      add(line, reference, {
        column: bad.label,
        severity: bad.refused ? "error" : "warning",
        category: "value",
        message: bad.refused
          ? `"${bad.raw}" is not a value ${bad.label} accepts. Expected one of: ${options}.`
          : `${bad.label} "${bad.raw}" isn't one the import recognises, so it will be imported blank; add it later on the member's page. Expected one of: ${options}.`,
        value: bad.raw,
      });
    }

    for (const missing of missingRequiredFields(row, context.shape)) {
      add(line, reference, {
        column: missing.label,
        severity: missing.refused ? "error" : "warning",
        category: "required",
        message: missing.refused
          ? `${missing.label} is blank, and this row cannot be imported without it.`
          : `${missing.label} is blank. ${missing.whenBlank ?? "The member will be imported without it; add it later on their page."}`,
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

    // Each date as read, for the rules that compare one with another.
    const readDates: Record<string, string> = {};
    for (const date of context.dates) {
      // A blocked column is reported once, for the whole file, in `blockers`.
      // A column still waiting on the admin is not judged at all yet: parsing
      // it under a guessed order is the exact mistake this screen prevents.
      if (date.blocked || date.order === undefined) continue;
      const index = dateIndex.get(date.key) ?? -1;
      const cell = String(fields[index] ?? "").trim();
      if (!cell) continue; // Blank is `missingRequiredFields`' question.
      const parsed = parseImportDate(cell, date.order);
      if (parsed.ok) {
        readDates[date.key] = parsed.iso;
        continue;
      }
      add(line, reference, {
        column: date.label,
        severity: "error",
        category: "date",
        message: dateMessage(date.label, cell, parsed.reason, date.order),
        value: cell,
      });
    }

    if (context.shape === "customer") {
      for (const problem of memberFieldProblems(row, { dates: readDates, today, membershipAllowed })) {
        add(line, reference, {
          column: problem.label,
          severity: problem.severity,
          category: problem.category,
          message: problem.message,
          value: problem.raw,
        });
      }

      // A number is one member's: the server keeps the first row that has it
      // and refuses the rest, so the pre-check says so of the rest.
      const memberNumber = membershipAllowed ? canonicalMemberNumber(row.membership_number ?? "") : "";
      if (memberNumber) {
        const seen = memberNumberAt.get(memberNumber);
        if (seen === undefined) memberNumberAt.set(memberNumber, line);
        else {
          add(line, reference, {
            column: "Membership Number",
            severity: "error",
            category: "duplicate",
            message: `Membership Number ${memberNumber} is already on line ${seen}. Each member's number is their own, so this row can't be imported with it.`,
            value: (row.membership_number ?? "").trim(),
          });
        }
      }
    }

    if (context.shape === "loans") {
      for (const problem of loanFieldProblems(row)) {
        add(line, reference, {
          column: problem.label,
          severity: problem.severity,
          category: problem.category,
          message: problem.message,
          value: problem.raw,
        });
      }
    }

    if (context.shape === "share_capital") {
      for (const problem of shareCapitalFieldProblems(row, today)) {
        add(line, reference, {
          column: problem.label,
          severity: problem.severity,
          category: problem.category,
          message: problem.message,
          value: problem.raw,
        });
      }

      // Only a row the server takes is remembered as the first, as it does.
      const repeat = rowHasError ? null : shareCapitalRepeat?.(row, line);
      if (repeat) {
        add(line, reference, { column: repeat.column, severity: "error", category: "duplicate", message: repeat.message, value: repeat.value });
      }
    }

    // A member's account on many rows is what a share capital file is, so its
    // rows repeat by the rule above instead.
    if (reference && context.shape !== "share_capital") {
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

    if (context.knownAccounts && accountIndex >= 0 && context.shape !== "customer") {
      const account = String(fields[accountIndex] ?? "").trim();
      if (account && !context.knownAccounts.has(account)) {
        add(line, reference, {
          column: columns[accountIndex].label,
          severity: "warning",
          category: "cross-file",
          message:
            context.shape === "share_capital"
              ? `No member with account number ${account} is in the members file. A member already in Lendyph is matched on the server by account number or member ID, so this row can still land; if no member has it, the row is refused.`
              : `No member with Account No. ${account} is in the customers file. Members who already exist in Lendyph are matched on the server, so this loan can still land — but if they do not exist, this row will fail.`,
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
  headerSkipped = false,
): string[] {
  const blockers: string[] = [];

  for (const notice of inspection.notices) {
    if (notice.severity === "error") blockers.push(notice.message);
  }

  if (rows.length === 0) {
    const empty =
      inspection.records.length === 0
        ? "No rows were found in this file."
        : "The only row in this file is the header row, so there is nothing to import.";
    // A members-only import is allowed, so an empty loans file is one to drop,
    // and so is an empty share capital file.
    blockers.push(
      inspection.kind === "loans"
        ? `${empty} The loans file is optional: leave it out when there are no loans to bring over.`
        : inspection.kind === "share_capital"
          ? `${empty} The share capital file is optional: leave it out when there is no share capital to bring over.`
          : empty,
    );
  }

  const wrongSlot = inspection.slot?.shape && inspection.slot.shape !== inspection.shape;
  if (wrongSlot) {
    blockers.push(
      `This looks like the ${fileNameInSentence(
        KIND_BY_SHAPE[inspection.slot?.shape ?? inspection.shape],
      )}, but it was chosen as the ${fileNameInSentence(inspection.kind)}. Importing it here would write each value into the wrong field.`,
    );
  }

  // The commonest width IS the file's shape. A handful of ragged rows is a row
  // problem; a whole file at the wrong width is a different file.
  const modal = inspection.widths[0];
  if (!wrongSlot && modal && rows.length > 0 && modal.columns !== inspection.expectedColumns) {
    blockers.push(
      `Most rows have ${modal.columns} columns, but the ${fileNameInSentence(inspection.kind)} needs ${expectedWidthWords(inspection.shape)}. Check the file was exported whole and that no columns were added or removed.`,
    );
  }

  // The server holds a header to every column of the rows' layout, and a
  // blank label matches no column, so a header that leaves one unnamed is a
  // file it refuses. A label that merely differs may be one of the server's
  // accepted spellings, which this check cannot know, so only blanks block.
  const widthFits = Boolean(modal && modal.columns === inspection.expectedColumns);
  const unnamed =
    headerSkipped && widthFits && inspection.header?.isHeader
      ? inspection.header.mismatched.filter((mismatch) => mismatch.found.trim() === "")
      : [];
  if (!wrongSlot && unnamed.length > 0) {
    const named = listWords(unnamed.map((mismatch) => mismatch.expected));
    blockers.push(
      `Row 1 is the header, but it leaves ${unnamed.length === 1 ? "a column" : `${unnamed.length} columns`} unnamed: ${named}. The import holds the header to every column the rows have, so it would refuse this file. Add the missing labels; the ${
        inspection.shape === "customer" ? "members" : inspection.shape === "loans" ? "loans" : "share capital"
      } template has them all.`,
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
    bits.push(
      `${formatCount(stats.shortYear)} ${stats.shortYear === 1 ? "has" : "have"} a two-digit year (${stats.shortYearSamples.join(", ")})`,
    );
  }
  if (stats.invalid > 0) {
    bits.push(
      `${formatCount(stats.invalid)} ${stats.invalid === 1 ? "is not a real date" : "are not real dates"} (${stats.invalidSamples.join(", ")})`,
    );
  }
  if (stats.unrecognised > 0) {
    bits.push(
      `${formatCount(stats.unrecognised)} ${stats.unrecognised === 1 ? "is not a date at all" : "are not dates at all"} (${stats.unrecognisedSamples.join(", ")})`,
    );
  }
  return bits.length > 0 ? `Of ${formatCountOf(stats.total, "value")}, ${bits.join("; ")}.` : "";
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
  membershipAllowed = true,
): Partial<Record<ImportFileKind, FileFindings>> {
  const customers = inspections.customers;
  const knownAccounts = customers
    ? accountNumbersIn(customers, skipHeader.customers ?? customers.header?.isHeader ?? false)
    : null;

  const findings: Partial<Record<ImportFileKind, FileFindings>> = {};

  for (const kind of IMPORT_FILE_KINDS) {
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
      // Loans and share capital name members by account; members are the list.
      knownAccounts: kind === "customers" ? null : knownAccounts,
      expectedColumns: inspection.expectedColumns,
      membershipAllowed,
    });

    findings[kind] = {
      kind,
      totalRows: rows.length,
      checkedRows: checked.length,
      rowsNotChecked: rows.length - checked.length,
      dates,
      ...totals,
      // Every file's blockers share one list on screen, so each names its file.
      blockers: fileBlockers(inspection, rows, dates, skip).map(
        (blocker) => `${inspection.label} (${inspection.fileName}): ${blocker}`,
      ),
      pendingDecisions: pendingFor(dates),
    };
  }

  return findings;
}

// ---------------------------------------------------------------------------
// The answers, in the shape the session record stores them
// ---------------------------------------------------------------------------

/** A settled date order, written the way `ImportSession.dateFormat` records it. */
export const DATE_FORMAT_PATTERNS: Record<DateOrder, string> = {
  dmy: "dd/MM/yyyy",
  mdy: "MM/dd/yyyy",
};

/** What a column of ISO dates and/or Excel serials is written as. */
export const ISO_DATE_FORMAT = "yyyy-MM-dd";

/** One file's answers, in the only shape this conversion needs to see. */
export interface FileSessionAnswer {
  kind: ImportFileKind;
  skipHeaderRow: boolean;
  /** Per date column. `null` = the column needs no order. */
  dateOrders: Readonly<Record<string, DateOrder | null>>;
}

/** The slice of `ImportSession` step 2 settles, `productMap` aside. */
export interface SessionAnswers {
  hasHeaderRow: Partial<Record<ImportFileKind, boolean>>;
  dateFormat: Partial<Record<ImportFileKind, Record<string, string>>>;
}

/**
 * Write the per-file, per-column answers the way `ImportSession` stores them.
 *
 * A change of notation, not of meaning: nothing is merged, averaged, or
 * dropped. Both fields are keyed per file because both answers genuinely are
 * per file — the server models header-skipping per file
 * (`ImportFileStatus.staging.header_skipped`), and one sheet routinely has a
 * header row while the other does not, because the client's spec tells coops to
 * delete it and they delete it from one. Inside a file, `dateFormat` stays per
 * COLUMN, because that is the grain a date order is settled at: `03/04` is
 * ambiguous on its own, and one sheet can prove day-first in a birth date and
 * month-first in a release date.
 *
 * A file that was not inspected gets NO key, which is exactly what the record
 * defines as "not answered". It is never written as `false` or as a default
 * pattern: an unasked header question stored as "no header" eats a member row
 * as a heading on resume, and nothing downstream can tell, because both
 * outcomes parse.
 */
export function sessionAnswers(
  answers: readonly FileSessionAnswer[],
): SessionAnswers {
  const hasHeaderRow: Partial<Record<ImportFileKind, boolean>> = {};
  const dateFormat: Partial<Record<ImportFileKind, Record<string, string>>> = {};

  for (const answer of answers) {
    hasHeaderRow[answer.kind] = answer.skipHeaderRow;

    const columns: Record<string, string> = {};
    for (const [column, order] of Object.entries(answer.dateOrders)) {
      // A column that needs no order is still an ANSWER — "this one is written
      // ISO" — so it is recorded rather than left absent, and a resume does not
      // re-ask a question the file itself already settled.
      columns[column] = order ? DATE_FORMAT_PATTERNS[order] : ISO_DATE_FORMAT;
    }
    dateFormat[answer.kind] = columns;
  }

  return { hasHeaderRow, dateFormat };
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
 *
 * `membershipAllowed` is whether the admin can edit members, which the
 * membership columns need on top of importing (the server's rule).
 */
export function useFilePrecheck(
  files: Partial<Record<ImportFileKind, File | null | undefined>>,
  { membershipAllowed = true }: { membershipAllowed?: boolean } = {},
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
  const shareCapitalFile = files.share_capital ?? null;
  const lastProgressAt = useRef(0);

  useEffect(() => {
    const picked: Array<[ImportFileKind, File]> = [];
    if (customersFile) picked.push(["customers", customersFile]);
    if (loansFile) picked.push(["loans", loansFile]);
    if (shareCapitalFile) picked.push(["share_capital", shareCapitalFile]);

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
  }, [customersFile, loansFile, shareCapitalFile, attempt]);

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
      const next = computeFindings(inspections, skipHeaderState, dateChoices, ROW_CHECK_CEILING, membershipAllowed);
      if (cancelled) return;
      setFindings(next);
      setComputing(false);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [inspections, skipHeaderState, dateChoices, membershipAllowed]);

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
    () => IMPORT_FILE_KINDS.map((kind) => findings[kind]).filter((f): f is FileFindings => Boolean(f)),
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
