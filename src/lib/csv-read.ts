/**
 * Reading a user's CSV file — the decoder and the parser as one piece.
 *
 * This module exists because of one specific, measured failure. The obvious way
 * to read a large file in the browser is to slice it and call `.text()` on each
 * slice. `.text()` decodes every slice INDEPENDENTLY, so any UTF-8 character
 * whose bytes straddle the cut is decoded as two invalid fragments and comes
 * back as U+FFFD. Reading a 2.4 MB member export in 64 KB slices that way
 * corrupted five characters — and the parse still reported the correct number of
 * rows, every one the correct width, with no error raised anywhere. The only
 * symptom is `Peña` stored as `Pe?a` in that member's own lending record, found
 * months later by a person. Wrong, and completely plausible.
 *
 * The fix is one `TextDecoder` for the whole file with `{ stream: true }`, which
 * holds an incomplete sequence back and prepends it to the next chunk. One
 * decoder feeding one parser instance is a single invariant, so the two live in
 * one function on purpose: they cannot be pulled apart by a later refactor, and
 * no caller has to know the rule to get it right.
 *
 * Everything this can tell the user about the FILE — a bad encoding, an
 * unbalanced quote — comes back in `notices`, one entry each, never per row.
 * Both are conditions where the rows themselves are usually fine.
 */

import {
  createCsvParser,
  sniffDelimiter,
  type CsvParseOptions,
  type CsvParser,
  type CsvRecord,
  type DelimiterSniff,
} from "./csv-parse";

/** 64 KB slices: small enough to keep the UI responsive, large enough that the overhead disappears. */
const DEFAULT_CHUNK_BYTES = 64 * 1024;

/** U+FFFD. Present in decoded text only when bytes could not be read as UTF-8. */
const REPLACEMENT = "�";

export interface CsvReadProgress {
  bytesRead: number;
  totalBytes: number;
  /** 0–1, and 1 for an empty file rather than NaN. */
  ratio: number;
  /** Records completed so far — for "1,240 rows read" next to the bar. */
  records: number;
}

export type CsvNoticeCode = "not-utf8" | "unterminated-quote";

/**
 * Something to tell the user about the file as a whole. Uniform shape so a page
 * can render the list without knowing which codes exist.
 */
export interface CsvFileNotice {
  code: CsvNoticeCode;
  /** `warning`: the rows are still usable. `error`: the parse itself is not trustworthy. */
  severity: "warning" | "error";
  /** Ready to display. */
  message: string;
}

export interface CsvReadOptions extends CsvParseOptions {
  /** Bytes per slice. Default 64 KB. */
  chunkBytes?: number;
  /**
   * Called after every chunk and once more when the read finishes, so the final
   * call always carries `ratio: 1` and the complete record count. Throttle in
   * the caller if it drives React state — a 40 MB file fires ~640 times.
   */
  onProgress?: (progress: CsvReadProgress) => void;
  /** Cancels the read between chunks; rejects with the signal's reason. */
  signal?: AbortSignal;
}

export interface CsvReadResult {
  records: CsvRecord[];
  /** The delimiter actually used, whether it was passed in or detected. */
  delimiter: string;
  /** The evidence behind a detected delimiter; `null` when the caller specified one. */
  sniff: DelimiterSniff | null;
  /** File-level problems worth showing. Never a row-level complaint. */
  notices: CsvFileNotice[];
  /**
   * Characters that could not be decoded as UTF-8. Above zero means the file is
   * probably a non-UTF-8 export — NOT that the rows are bad. See the `not-utf8`
   * notice; row validation must not reject a value for containing U+FFFD.
   */
  replacementChars: number;
  /** The input ended inside an unclosed quote, so the tail is one runaway field. */
  unterminatedQuote: boolean;
  bytesRead: number;
}

function countReplacements(text: string): number {
  let count = 0;
  for (let i = text.indexOf(REPLACEMENT); i !== -1; i = text.indexOf(REPLACEMENT, i + 1)) count++;
  return count;
}

/**
 * The copy for a file that is not UTF-8.
 *
 * Deliberately a notice and not a row error. The server reads the ORIGINAL bytes
 * and converts them, so the rows this preview shows as damaged will import
 * correctly. Reporting them as broken data would tell an admin their file is
 * wrong when it is not — on the one screen whose whole job is to be believed.
 */
function notUtf8Notice(count: number): CsvFileNotice {
  const characters = count === 1 ? "1 character" : `${count} characters`;
  return {
    code: "not-utf8",
    severity: "warning",
    message: `${characters} could not be read as UTF-8, so some names may look wrong in the preview below (Peña as Pe?a). This is how the file was saved, not bad data: the import reads the original file and converts it, so these rows still come through correctly. To see them correctly here, re-export from Excel as "CSV UTF-8".`,
  };
}

function unterminatedQuoteNotice(line: number | null): CsvFileNotice {
  const where = line === null ? "A row" : `The row starting on line ${line}`;
  return {
    code: "unterminated-quote",
    severity: "error",
    message: `${where} opens a quote (") that is never closed, so everything after it was read as one long value and the rows below it were not separated. Look for a stray quote mark there.`,
  };
}

/**
 * Read a CSV file into records.
 *
 * Takes a `Blob` so a test can pass one directly — a `File` is a `Blob`.
 *
 * With no `delimiter` the first chunk is sniffed and the result reports what was
 * found, which keeps the delimiter used for parsing and the delimiter shown to
 * the user from ever disagreeing. Pass one to honour a manual override.
 */
export async function readCsvFile(
  file: Blob,
  options: CsvReadOptions = {},
): Promise<CsvReadResult> {
  const { chunkBytes = DEFAULT_CHUNK_BYTES, onProgress, signal, ...parseOptions } = options;
  const totalBytes = file.size;

  // One decoder for the whole file. `{ stream: true }` is what makes a chunk
  // boundary in the middle of a character harmless.
  const decoder = new TextDecoder("utf-8");
  let parser: CsvParser | null = null;
  let sniff: DelimiterSniff | null = null;
  let delimiter = parseOptions.delimiter ?? null;

  const records: CsvRecord[] = [];
  let replacementChars = 0;
  let bytesRead = 0;

  const report = () =>
    onProgress?.({
      bytesRead,
      totalBytes,
      ratio: totalBytes === 0 ? 1 : bytesRead / totalBytes,
      records: records.length,
    });

  // Takes and returns the parser rather than closing over it: narrowing does not
  // survive a closure assignment, and an "it cannot still be null" assertion at
  // the end would be exactly the kind of claim this module exists to avoid.
  const consume = (text: string, current: CsvParser | null): CsvParser | null => {
    if (text === "") return current;
    replacementChars += countReplacements(text);
    let active = current;
    if (active === null) {
      // First text out of the decoder: settle the delimiter before a single
      // record is parsed with the wrong one.
      if (delimiter === null) {
        sniff = sniffDelimiter(text);
        delimiter = sniff.delimiter;
      }
      active = createCsvParser({ ...parseOptions, delimiter });
    }
    records.push(...active.push(text));
    return active;
  };

  for (let offset = 0; offset < totalBytes; offset += chunkBytes) {
    signal?.throwIfAborted();
    const bytes = await file.slice(offset, offset + chunkBytes).arrayBuffer();
    parser = consume(decoder.decode(new Uint8Array(bytes), { stream: true }), parser);
    bytesRead = Math.min(offset + chunkBytes, totalBytes);
    report();
  }

  // Flush both, decoder first: a file that ends mid-character emits its final
  // U+FFFD here, and that text still has to reach the parser.
  signal?.throwIfAborted();
  parser = consume(decoder.decode(), parser);
  if (parser !== null) records.push(...parser.flush());

  const unterminatedQuote = parser?.unterminatedQuote() ?? false;
  const notices: CsvFileNotice[] = [];
  if (replacementChars > 0) notices.push(notUtf8Notice(replacementChars));
  if (unterminatedQuote) {
    // The runaway field belongs to the last record, so that record's start line
    // is where the user needs to look.
    notices.push(unterminatedQuoteNotice(records.at(-1)?.line ?? null));
  }

  bytesRead = totalBytes;
  report();

  return {
    records,
    delimiter: delimiter ?? ",",
    sniff,
    notices,
    replacementChars,
    unterminatedQuote,
    bytesRead,
  };
}
