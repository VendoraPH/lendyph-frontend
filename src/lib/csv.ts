/**
 * CSV primitives.
 *
 * Extracted from `reports/_lib/report-csv.ts` when the data-import template
 * grew a second CSV writer: the quoting rules are RFC 4180, not a report
 * concern, and two copies of an escape function is exactly how one of them
 * ends up wrong.
 */

/**
 * Excel ignores the charset in a blob's MIME type when opening a local file
 * and falls back to the system code page, which turns every peso sign into
 * mojibake. A BOM is the only signal it honours.
 */
export const UTF8_BOM = "\uFEFF";

export function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsvRow(values: (string | null | undefined)[]): string {
  return values.map((v) => escapeCsvCell(v ?? "")).join(",");
}

/** CRLF line endings, because Excel is the consumer that matters here. */
export function toCsv(rows: (string | null | undefined)[][]): string {
  return rows.map(toCsvRow).join("\r\n");
}

export function csvBlob(text: string): Blob {
  return new Blob([UTF8_BOM + text], { type: "text/csv;charset=utf-8" });
}
