import { saveAs } from "file-saver";
import { csvRow, neutraliseCsvFormula } from "./csv-escape";
import { todayISO } from "./format";

/**
 * The pre-check findings, as a CSV the admin can work from.
 *
 * These are the problems found in the browser BEFORE a single byte is uploaded
 * — a blank member name, an amount that is not a number, a date that is
 * ambiguous under the chosen format, a product label with no mapping. They
 * never reach the server, so unlike every other export in this app there is no
 * endpoint that could render them: this one genuinely has to be built on the
 * client.
 *
 * The point is the workflow. A co-op's CSV comes out of someone's Excel with a
 * dozen bad rows scattered through it, and "12 rows have problems" on screen is
 * unusable — the admin needs the list beside the spreadsheet, by row number, to
 * fix it and re-upload. So it is emitted in the same format they are already
 * holding.
 *
 * Pure render split from the download exactly as
 * `src/app/(app)/reports/_lib/report-csv.ts` does it, so the escaping is
 * unit-testable against the text actually written rather than against the model
 * that produced it.
 */

/** One problem with one row. */
export interface ImportIssue {
  /** Which CSV it came from — the upload slot or file name. Omit if only one. */
  file?: string;
  /** 1-based line number as the admin sees it in their spreadsheet. */
  row: number;
  /** Column heading, for a cell-level problem. */
  column?: string;
  /** The offending value verbatim — the admin has to recognise it to find it. */
  value?: string;
  /** What is wrong, in words that say what to do about it. */
  problem: string;
}

/**
 * One data record.
 *
 * Every cell is run through the formula guard first, because every cell can
 * carry the admin's own file back to them: the value verbatim by definition,
 * the column name from their header row, and the problem message with their
 * value quoted inside it. The guard is the API's, character for character —
 * see `neutraliseCsvFormula`. Quoting then happens on top of it, so a
 * neutralised value that also contains a comma is still one cell.
 *
 * The heading row is written with plain `csvRow` instead: those four words are
 * ours, and the backend does not sanitise its headers either
 * (`fputcsv($handle, $headers)` runs before its own sanitising loop).
 */
function dataRow(values: (string | null | undefined)[]): string {
  return csvRow(values.map((v) => neutraliseCsvFormula(v ?? "")));
}

/**
 * The error report as CSV text.
 *
 * The `File` column appears only when at least one issue names a file, so a
 * single-file check does not hand back a column of blanks. With no issues the
 * header row is emitted alone — an empty report is a legitimate answer, and a
 * file with headings and no rows says that unambiguously.
 */
export function renderImportErrorCsv(issues: ImportIssue[]): string {
  const hasFiles = issues.some((issue) => !!issue.file);
  const heading = hasFiles
    ? ["File", "Row", "Column", "Value", "Problem"]
    : ["Row", "Column", "Value", "Problem"];

  const lines = [csvRow(heading)];
  for (const issue of issues) {
    const cells = [String(issue.row), issue.column, issue.value, issue.problem];
    lines.push(dataRow(hasFiles ? [issue.file, ...cells] : cells));
  }
  return lines.join("\r\n");
}

/**
 * Excel ignores the charset in a blob's MIME type when opening a local file and
 * falls back to the system code page, which turns every ñ and ₱ in a member's
 * name into mojibake. A BOM is the only signal it honours.
 */
const UTF8_BOM = "\uFEFF";

/** `import-errors-members-2026-08-29` — slugified, matching the report exports. */
function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Download the report.
 *
 * The date comes from `todayISO()`, never `new Date().toISOString()`: the app
 * runs on Philippine Standard Time and the UTC instant still falls on the
 * previous day until 08:00, so an admin working the morning shift would file
 * yesterday's dated report. It is an ESLint error in this repo for good reason.
 */
export function downloadImportErrorCsv(
  issues: ImportIssue[],
  label = "import-errors",
): void {
  const blob = new Blob([UTF8_BOM + renderImportErrorCsv(issues)], {
    type: "text/csv;charset=utf-8",
  });
  saveAs(blob, `${slugify(label)}-${todayISO()}.csv`);
}
