/**
 * Streaming RFC-4180 CSV parser for the data-migration upload page.
 *
 * The page never holds the whole file: it reads the user's `File` in slices and
 * feeds each decoded chunk to `push()`, which returns the records that were
 * COMPLETED by that chunk. Anything half-read is kept as parser state until the
 * next `push()`, and `flush()` releases the tail (a last row with no trailing
 * newline). That is the entire reason this is a state machine and not a
 * `text.split("\n").map(l => l.split(","))`:
 *
 *  1. A quoted field may contain a newline, so a line is NOT a record. Splitting
 *     on newlines shreds one member's address into three broken rows.
 *  2. That embedded newline lands on a chunk boundary sooner or later, and a
 *     parser that starts each chunk from a clean slate resumes in the wrong
 *     state — the rest of the quoted value becomes a row of its own, and every
 *     column after it is off by one for the remainder of the file. On a 5,000
 *     row member import the user sees "4,997 rows failed" with no clue why.
 *     Every piece of cross-chunk state below (`inQuotes`, `afterQuote`,
 *     `prevCR`) exists for a boundary that can split at exactly that character.
 *
 * Deliberately hand-rolled instead of adding `papaparse`: one route does not
 * justify a dependency (bundle, licence, audit trail), and a pure function is
 * what this repo's `tsx --test` harness can actually hold down. The trade is
 * that the tests carry the weight — see `csv-parse.test.ts`.
 *
 * Never throws on data. Ragged rows, stray quotes and unbalanced quotes are all
 * reported, not raised: a migration file is user data, and the job of this
 * module is to describe what is there so the caller can tell the user.
 *
 * This takes decoded TEXT and knows nothing about files, which keeps it pure and
 * testable — but that boundary is exactly where data gets corrupted, so do not
 * feed it by hand. Slicing a `File` and calling `.text()` on each slice
 * independently mangles every multi-byte character that straddles a cut (`ñ`,
 * `é`, `₱` — routine in Filipino member names) and the parse still looks
 * perfect. Use `readCsvFile` from `./csv-read`, which owns the one decoder this
 * parser needs.
 */

/** The delimiters `sniffDelimiter` knows how to recognise. Comma first: it wins ties. */
export const CSV_DELIMITERS = [",", ";", "\t"] as const;

export type CsvDelimiter = (typeof CSV_DELIMITERS)[number];

/** Words for a UI: "Detected semicolon-delimited, 7 columns." */
export const DELIMITER_LABELS: Record<CsvDelimiter, string> = {
  ",": "comma",
  ";": "semicolon",
  "\t": "tab",
};

export interface CsvRecord {
  /**
   * 0-based index among EMITTED records — record 0 is the header row, so this
   * is the number to quote when the message is about a spreadsheet row.
   * Skipped blank lines do not consume an index.
   */
  index: number;
  /**
   * 1-based physical line where this record STARTS. Differs from `index` as
   * soon as a quoted field contains a newline, and it is the number that leads
   * the user to the right place in a text editor. Both are reported because
   * neither one alone is right for every message.
   */
  line: number;
  /** The parsed values. The row's width is `fields.length` — ragged rows are legal here. */
  fields: string[];
}

export interface CsvParseOptions {
  /** Single character. Default `","`. Use `sniffDelimiter` rather than assuming. */
  delimiter?: string;
  /**
   * Drop lines that are completely empty (default `true`). Excel litters exports
   * with trailing and interstitial blank lines, and reporting each one as "1
   * column, expected 12" buries the real errors. A quoted `""` is a value, not a
   * blank line, and `,,` is a row of empty fields — neither is dropped.
   *
   * Set it to `false` for a SINGLE-COLUMN file (one where `sniffDelimiter`
   * reports `detected: false`). There, a row with a missing value is
   * indistinguishable from a blank line, so the default quietly drops a row the
   * user needs to be told about.
   */
  skipEmptyLines?: boolean;
}

export interface CsvParser {
  /** Feed a decoded chunk. Returns only the records completed by it. */
  push(text: string): CsvRecord[];
  /** End of input: releases a final record that had no trailing newline. */
  flush(): CsvRecord[];
  /**
   * True when the input ran out mid-quote. Read it after `flush()`. Worth
   * surfacing: one unbalanced quote swallows the whole rest of the file into a
   * single field, so the user sees "3 rows found" for a 5,000 row file and the
   * count is the only symptom.
   */
  unterminatedQuote(): boolean;
}

const QUOTE = '"';

export function createCsvParser(options: CsvParseOptions = {}): CsvParser {
  const delimiter = options.delimiter ?? ",";
  if (delimiter.length !== 1 || delimiter === QUOTE || delimiter === "\n" || delimiter === "\r") {
    // A programmer error, never a data error — data never reaches this line.
    throw new TypeError(
      `Invalid CSV delimiter ${JSON.stringify(delimiter)}: expected one character other than a quote or a line break.`,
    );
  }
  const skipEmptyLines = options.skipEmptyLines ?? true;

  let fields: string[] = [];
  let field = "";
  /** Inside a quoted field, past the opening quote. */
  let inQuotes = false;
  /** The last character was a quote that MIGHT close the field — or might be the first half of `""`. */
  let afterQuote = false;
  /** The last character was a CR: its LF must not end a second record, and must not count a second line. */
  let prevCR = false;
  /** This record has consumed at least one character of its own (blank lines have not). */
  let started = false;
  /** This record contained a quoted field, so `[""]` is a value rather than an empty line. */
  let quoted = false;
  /** Nothing consumed yet, so a leading U+FEFF is a BOM rather than data. */
  let atStart = true;
  let index = 0;
  let line = 1;
  let recordLine = 1;
  let endedInQuotes = false;

  function endRecord(records: CsvRecord[]): void {
    fields.push(field);
    field = "";
    const blankLine = !quoted && fields.length === 1 && fields[0] === "";
    if (!(skipEmptyLines && blankLine)) {
      records.push({ index, line: recordLine, fields });
      index++;
    }
    fields = [];
    started = false;
    quoted = false;
    // `line` was already advanced by the terminator that got us here.
    recordLine = line;
  }

  function push(text: string): CsvRecord[] {
    const records: CsvRecord[] = [];
    if (atStart && text.length > 0) {
      atStart = false;
      // Excel writes one on every CSV it exports (it is the only hint it honours
      // about the encoding), so without this the first header cell arrives as
      // U+FEFF + "id" and never matches a column name.
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    }

    // Iterating UTF-16 code units is safe: no half of a surrogate pair can equal
    // a delimiter, a quote or a line break, and the halves are appended in order.
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      // Line counting in one place, so CR, LF and CRLF each count exactly one.
      if (ch === "\n") {
        if (!prevCR) line++;
      } else if (ch === "\r") {
        line++;
      }
      const afterCR = prevCR;
      prevCR = ch === "\r";

      if (afterQuote) {
        afterQuote = false;
        if (ch === QUOTE) {
          // "" inside quotes is one literal quote.
          field += QUOTE;
          continue;
        }
        // The quote closed the field. Fall through and let this character be
        // handled unquoted — which also makes `"a"b` degrade to `ab` rather
        // than throwing away the row.
        inQuotes = false;
      }

      if (inQuotes) {
        if (ch === QUOTE) {
          afterQuote = true;
          continue;
        }
        // Newlines are data in here, kept exactly as written — normalising them
        // would silently rewrite the user's addresses.
        field += ch;
        continue;
      }

      if (ch === delimiter) {
        started = true;
        fields.push(field);
        field = "";
        continue;
      }
      if (ch === "\n") {
        if (!afterCR) endRecord(records);
        continue;
      }
      if (ch === "\r") {
        endRecord(records);
        continue;
      }
      if (ch === QUOTE && field === "") {
        inQuotes = true;
        quoted = true;
        started = true;
        continue;
      }
      // A quote anywhere else in an unquoted field is literal: `5" pipe` is a
      // measurement, not a parse error.
      field += ch;
      started = true;
    }

    return records;
  }

  function flush(): CsvRecord[] {
    const records: CsvRecord[] = [];
    endedInQuotes = inQuotes && !afterQuote;
    if (started || field !== "" || fields.length > 0) {
      inQuotes = false;
      afterQuote = false;
      endRecord(records);
    }
    prevCR = false;
    return records;
  }

  return { push, flush, unterminatedQuote: () => endedInQuotes };
}

/**
 * Whole-string convenience — the streaming path with both ends tied off. For
 * tests, sniffing, and pasted text; the upload page uses `createCsvParser`.
 */
export function parseCsv(text: string, options: CsvParseOptions = {}): CsvRecord[] {
  const parser = createCsvParser(options);
  return [...parser.push(text), ...parser.flush()];
}

export interface DelimiterSniff {
  delimiter: CsvDelimiter;
  /** "comma" | "semicolon" | "tab" — for the line of copy that tells the user what we did. */
  label: string;
  /** Delimiters seen OUTSIDE quotes in the sample, per candidate. The evidence behind the pick. */
  counts: Record<CsvDelimiter, number>;
  /** Columns the winner produced in the first sampled row. */
  columns: number;
  /** Rows sampled — 0 or 1 means the pick rests on very little. */
  rows: number;
  /** Every sampled row had the same width. False means ragged data, or the wrong delimiter. */
  consistent: boolean;
  /**
   * A delimiter was actually FOUND. False means the sample had none of the three
   * and `delimiter` is the comma fallback — either a genuine single-column file
   * or a file this parser cannot read. Say so rather than reporting "comma".
   */
  detected: boolean;
}

/** Rows to look at. Enough for a run of names-with-commas to break the tie honestly. */
const SNIFF_RECORDS = 10;
/** Defensive cap; the caller should already be passing a small head of the file. */
const SNIFF_CHARS = 64 * 1024;

interface Candidate {
  delimiter: CsvDelimiter;
  count: number;
  columns: number;
  rows: number;
  consistent: boolean;
}

function score(text: string, delimiter: CsvDelimiter, limit: number): Candidate {
  const parser = createCsvParser({ delimiter });
  const complete = parser.push(text);
  const tail = parser.flush();
  // A sample is a truncated read: its last record is probably half a row and
  // would vote for the wrong width. Only fall back to it if it is all there is.
  const rows = (complete.length > 0 ? complete : tail).slice(0, limit);
  const widths = rows.map((r) => r.fields.length);
  return {
    delimiter,
    count: widths.reduce((sum, w) => sum + w - 1, 0),
    columns: widths[0] ?? 0,
    rows: widths.length,
    consistent: widths.length > 0 && widths.every((w) => w === widths[0]),
  };
}

/**
 * Which delimiter is this file using?
 *
 * Not optional, and not a nicety. A semicolon-delimited export (the default in
 * any Excel installed under a European locale, and what several accounting
 * packages emit) read as comma-delimited yields exactly one column per row, so
 * every single row fails on "missing required column" — a message that tells the
 * user nothing about the actual problem. The result carries the counts so the
 * page can say what it found instead of failing silently.
 *
 * Counting is quote-aware — done by parsing, not by `String.split` — because
 * `"Dela Cruz, Juan";5000` contains a comma that belongs to a value. Counting
 * raw characters would hand that file to the comma parser. Note the limit of
 * that: quotes are only quotes relative to the candidate delimiter, so in
 * `1;"Dela Cruz, Juan"` the comma reading sees a mid-field quote, treats it as
 * literal, and does count the comma.
 *
 * Which is why consistency outranks raw count. A comma that is really part of a
 * name shows up on some rows and not others, leaving the comma reading ragged,
 * while the real delimiter appears the same number of times on every row.
 */
export function sniffDelimiter(
  sample: string,
  options: { records?: number } = {},
): DelimiterSniff {
  const limit = Math.max(1, options.records ?? SNIFF_RECORDS);
  const text = sample.length > SNIFF_CHARS ? sample.slice(0, SNIFF_CHARS) : sample;

  const scored = CSV_DELIMITERS.map((d) => score(text, d, limit));
  const counts = {} as Record<CsvDelimiter, number>;
  for (const candidate of scored) counts[candidate.delimiter] = candidate.count;

  const found = scored.filter((c) => c.count > 0);
  // Array.prototype.sort is stable, so an exact tie keeps CSV_DELIMITERS order
  // (comma, then semicolon, then tab) without a third comparison.
  found.sort((a, b) => Number(b.consistent) - Number(a.consistent) || b.count - a.count);

  // scored[0] is the comma candidate: the fallback when nothing was found at all.
  const winner = found[0] ?? scored[0];
  return {
    delimiter: winner.delimiter,
    label: DELIMITER_LABELS[winner.delimiter],
    counts,
    columns: winner.columns,
    rows: winner.rows,
    consistent: winner.consistent,
    detected: winner.count > 0,
  };
}
