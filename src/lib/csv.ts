/**
 * CSV writing primitives: the BOM, the record joiner, and the blob.
 *
 * Quoting is deliberately NOT here. `@/lib/csv-escape` owns RFC 4180 quoting
 * for every CSV this app writes, and this module re-uses it rather than
 * carrying a second escaper — which is what it did originally, and what
 * `csv-escape`'s own docblock exists to prevent. The copy that lived here
 * quoted `,` `"` and `\n` but not a lone `\r`: the exact gap that terminates a
 * record early and shifts every column after it into the wrong heading.
 */
import { csvRow } from "./csv-escape";

/**
 * Excel ignores the charset in a blob's MIME type when opening a local file
 * and falls back to the system code page, which turns every peso sign into
 * mojibake. A BOM is the only signal it honours.
 */
export const UTF8_BOM = "\uFEFF";

/** CRLF line endings, because Excel is the consumer that matters here. */
export function toCsv(rows: (string | null | undefined)[][]): string {
  return rows.map((values) => csvRow(values)).join("\r\n");
}

export function csvBlob(text: string): Blob {
  return new Blob([UTF8_BOM + text], { type: "text/csv;charset=utf-8" });
}
