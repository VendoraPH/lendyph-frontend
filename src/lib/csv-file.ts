/**
 * "Is this plausibly the CSV we were asked for?" — the cheap check the upload
 * page runs before it reads a byte.
 *
 * Deliberately NOT `validateUploadFile` from `./file-validation`, and
 * deliberately not an extra mode bolted onto it:
 *
 *  - That helper matches on MIME type, and a CSV's MIME type cannot be trusted.
 *    The same file arrives as `text/csv`, `application/vnd.ms-excel` (what
 *    Windows reports whenever Excel owns the .csv association),
 *    `application/csv`, or an empty string — a value the browser gets from the
 *    OS, not from the bytes. Any allowlist rejects legitimate exports, and the
 *    user cannot fix it: nothing about their file is actually wrong.
 *  - Its 5 MB default is an ID-photo limit. A member migration is routinely
 *    larger, and the page streams the file rather than holding it in memory.
 *
 * Extending the shared helper was the other option and is worse: the valid-ID
 * and photo callers depend on its strict list, and loosening it for CSV would
 * loosen it for them silently. So this stays separate and checks only what is
 * both meaningful and repairable by the user — the extension and the size.
 */

import type { FileValidationResult } from "./file-validation";

/** Accepted extensions. `.tsv` is included because the parser detects tab-delimited files. */
export const CSV_EXTENSIONS = [".csv", ".tsv"] as const;

/** For an `<input type="file" accept>`; keeps the picker and this check in step. */
export const CSV_FILE_ACCEPT = CSV_EXTENSIONS.join(",");

/**
 * Spreadsheet formats worth naming: a coop sending an .xlsx is not making a
 * mistake about our rules, they just have not exported yet, and "unsupported
 * file type" does not tell them what to do next.
 */
const WORKBOOK_EXTENSIONS = [".xlsx", ".xls", ".xlsm", ".ods", ".numbers"];

/**
 * Structural rather than `File`, so a unit test can pass a stub without a DOM —
 * a real `File` satisfies it. Same reason as `CryptoSource` in
 * `./registration-key`.
 */
export interface CsvFileLike {
  name: string;
  size: number;
}

export interface LooksLikeCsvOptions {
  /**
   * Optional ceiling. There is NO default: a limit invented here would be a
   * guess, and guessing low blocks the one migration the page exists for. Pass
   * one when the page has a real number behind it.
   */
  maxBytes?: number;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

function megabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} MB`;
}

/**
 * Never throws, and never claims a file is good — only that it is worth
 * opening. Whether the CONTENT is a CSV is settled by the parse, which is the
 * only honest test and happens moments later anyway.
 */
export function looksLikeCsv(
  file: CsvFileLike,
  options: LooksLikeCsvOptions = {},
): FileValidationResult {
  const extension = extensionOf(file.name);

  if (!(CSV_EXTENSIONS as readonly string[]).includes(extension)) {
    if (WORKBOOK_EXTENSIONS.includes(extension)) {
      return {
        ok: false,
        error: `${extension} is a spreadsheet, not a CSV. In Excel or Sheets choose File → Save As (or Download) → CSV, then upload that file.`,
      };
    }
    return {
      ok: false,
      error: `Please choose a CSV file (${CSV_EXTENSIONS.join(" or ")}).`,
    };
  }

  // 0 bytes is its own message: "no rows found" reads like the file was wrong
  // when in fact nothing was ever saved into it.
  if (file.size <= 0) {
    return { ok: false, error: "That file is empty (0 bytes)." };
  }

  const { maxBytes } = options;
  if (maxBytes !== undefined && file.size > maxBytes) {
    return {
      ok: false,
      error: `That file is ${megabytes(file.size)}, over the ${megabytes(maxBytes)} limit. Split it and import in batches.`,
    };
  }

  return { ok: true };
}
