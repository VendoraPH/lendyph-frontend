import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCsvParser,
  parseCsv,
  sniffDelimiter,
  type CsvParseOptions,
  type CsvRecord,
} from "./csv-parse";

const fieldsOf = (records: CsvRecord[]) => records.map((r) => r.fields);

/** Written as an escape on purpose: a literal U+FEFF in source is invisible. */
const BOM = "\uFEFF";

/** Feed the parser a specific sequence of chunks, exactly as the upload page does. */
function pushChunks(chunks: string[], options?: CsvParseOptions): CsvRecord[] {
  const parser = createCsvParser(options);
  const out: CsvRecord[] = [];
  for (const chunk of chunks) out.push(...parser.push(chunk));
  out.push(...parser.flush());
  return out;
}

function splitEvery(input: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < input.length; i += size) chunks.push(input.slice(i, i + size));
  return chunks;
}

/**
 * The whole reason this parser is a state machine: chunk boundaries are decided
 * by `File.slice()` byte offsets, so they land in the middle of quoted values,
 * between a CR and its LF, and between a closing quote and the comma after it.
 * Every one of those must parse identically to reading the file whole — so this
 * checks EVERY split point rather than a hopeful one.
 */
function assertSplitInvariant(input: string, options?: CsvParseOptions): void {
  const whole = parseCsv(input, options);
  for (let at = 0; at <= input.length; at++) {
    assert.deepEqual(
      pushChunks([input.slice(0, at), input.slice(at)], options),
      whole,
      `split at ${at} — before ${JSON.stringify(input.slice(0, at).slice(-6))}, after ${JSON.stringify(input.slice(at).slice(0, 6))}`,
    );
  }
  for (const size of [1, 2, 3, 5, 7, 13]) {
    assert.deepEqual(
      pushChunks(splitEvery(input, size), options),
      whole,
      `${size}-character chunks parsed differently`,
    );
  }
}

test("a header and a row become fields", () => {
  assert.deepEqual(fieldsOf(parseCsv("name,amount\nJuan,5000\n")), [
    ["name", "amount"],
    ["Juan", "5000"],
  ]);
});

test("a quoted field keeps the commas inside it", () => {
  assert.deepEqual(fieldsOf(parseCsv('id,name,city\n7,"Dela Cruz, Juan",Cebu\n')), [
    ["id", "name", "city"],
    ["7", "Dela Cruz, Juan", "Cebu"],
  ]);
});

test('a doubled "" inside quotes is one literal quote', () => {
  assert.deepEqual(fieldsOf(parseCsv('note\n"she said ""yes"" twice"\n')), [
    ["note"],
    ['she said "yes" twice'],
  ]);
});

test('a field that is only "" is an empty value', () => {
  assert.deepEqual(fieldsOf(parseCsv('a,b,c\n1,"",3\n')), [
    ["a", "b", "c"],
    ["1", "", "3"],
  ]);
});

// ---------------------------------------------------------------------------
// The headline failure mode. A newline inside a quoted field that straddles a
// push() boundary: a parser that restarts per chunk resumes outside the quote,
// turns the tail of one address into a row of its own, and every column after
// it is off by one for the rest of the file.
// ---------------------------------------------------------------------------

test("a quoted newline parses the same at EVERY chunk boundary", () => {
  assertSplitInvariant('id,address,city\n1,"12 Rizal St.\nBarangay Uno",Cebu\n2,"5 Mabini",Davao\n');
});

test("the record split by a chunk boundary keeps its embedded newline", () => {
  const input = '1,"12 Rizal St.\nBarangay Uno",Cebu\n';
  const at = input.indexOf("\nBarangay") + 1;
  assert.deepEqual(fieldsOf(pushChunks([input.slice(0, at), input.slice(at)])), [
    ["1", "12 Rizal St.\nBarangay Uno", "Cebu"],
  ]);
});

test("a quoted newline survives being fed one character at a time", () => {
  const input = 'a,b\n"line one\nline two",z\n';
  assert.deepEqual(fieldsOf(pushChunks(splitEvery(input, 1))), [
    ["a", "b"],
    ["line one\nline two", "z"],
  ]);
});

test("a CRLF cut between the CR and the LF is one line break, not two records", () => {
  assert.deepEqual(fieldsOf(pushChunks(["a,b\r", "\nc,d\r\n"])), [
    ["a", "b"],
    ["c", "d"],
  ]);
});

test("a boundary between a closing quote and the comma after it holds its state", () => {
  assert.deepEqual(fieldsOf(pushChunks(['1,"Dela Cruz, Juan"', ",Cebu\n"])), [
    ["1", "Dela Cruz, Juan", "Cebu"],
  ]);
});

test('a boundary in the middle of an escaped "" holds its state', () => {
  assert.deepEqual(fieldsOf(pushChunks(['note\n"say ""', 'yes""",end\n'])), [
    ["note"],
    ['say "yes"', "end"],
  ]);
});

test("push returns only completed records; the last partial row waits for flush", () => {
  const parser = createCsvParser();
  assert.deepEqual(fieldsOf(parser.push("a,b\nc,d")), [["a", "b"]]);
  assert.deepEqual(fieldsOf(parser.flush()), [["c", "d"]]);
});

test("a quoted field held open across pushes yields nothing until it closes", () => {
  const parser = createCsvParser();
  assert.deepEqual(parser.push('1,"first line\n'), []);
  assert.deepEqual(parser.push("second line"), []);
  assert.deepEqual(fieldsOf(parser.push('",Cebu\n')), [["1", "first line\nsecond line", "Cebu"]]);
});

// ---------------------------------------------------------------------------
// Line endings, BOM, trailing newline
// ---------------------------------------------------------------------------

test("CRLF and LF produce identical records", () => {
  const lf = "name,amount\nJuan,5000\nMaria,250\n";
  assert.deepEqual(fieldsOf(parseCsv(lf)), fieldsOf(parseCsv(lf.replace(/\n/g, "\r\n"))));
});

test("a CR left inside a quoted field is data, not a record break", () => {
  assert.deepEqual(fieldsOf(parseCsv('a,b\r\n"x\r\ny",z\r\n')), [
    ["a", "b"],
    ["x\r\ny", "z"],
  ]);
});

// Classic Mac / some accounting exports end lines with a bare CR.
test("bare CR line endings still separate records", () => {
  assert.deepEqual(fieldsOf(parseCsv("a,b\rc,d\r")), [
    ["a", "b"],
    ["c", "d"],
  ]);
});

// This app's own CSV export writes a BOM (it is the only encoding hint Excel
// honours), so a file exported from Lendyph and re-imported hits this path.
test("a leading BOM is stripped so the first header matches", () => {
  const [header] = parseCsv(`${BOM}id,name\n1,Juan\n`);
  assert.deepEqual(header.fields, ["id", "name"]);
});

test("a BOM is still stripped when the first push is empty", () => {
  assert.deepEqual(fieldsOf(pushChunks(["", `${BOM}id,name\n`])), [["id", "name"]]);
});

test("a U+FEFF later in the file is data, not a second BOM", () => {
  assert.deepEqual(fieldsOf(parseCsv(`${BOM}a\nx${BOM}y\n`)), [["a"], [`x${BOM}y`]]);
});

test("a trailing newline does not invent an empty final record", () => {
  assert.equal(parseCsv("a,b\n1,2\n").length, 2);
});

test("a missing trailing newline still yields the last row", () => {
  assert.deepEqual(fieldsOf(parseCsv("a,b\n1,2")), [
    ["a", "b"],
    ["1", "2"],
  ]);
});

test("a file that is exactly what this app exports round-trips", () => {
  const exported = `${BOM}Member,Amount\r\n"Dela Cruz, Juan","5,000.00"\r\n`;
  assert.deepEqual(fieldsOf(parseCsv(exported)), [
    ["Member", "Amount"],
    ["Dela Cruz, Juan", "5,000.00"],
  ]);
});

// ---------------------------------------------------------------------------
// Shapes that must be reported rather than thrown
// ---------------------------------------------------------------------------

test("empty input yields no records", () => {
  assert.deepEqual(parseCsv(""), []);
  const parser = createCsvParser();
  assert.deepEqual(parser.push(""), []);
  assert.deepEqual(parser.flush(), []);
});

test("header-only input yields exactly the header", () => {
  assert.deepEqual(fieldsOf(parseCsv("id,name,amount")), [["id", "name", "amount"]]);
  assert.deepEqual(fieldsOf(parseCsv("id,name,amount\n")), [["id", "name", "amount"]]);
});

// Ragged rows are the normal state of a hand-edited migration file. The parser
// reports each row's real width and lets the caller compare it to the header;
// padding or dropping here would hide the mistake the user has to fix.
test("ragged rows keep their own width and never throw", () => {
  const records = parseCsv("a,b,c\n1,2\n3,4,5,6\n");
  assert.deepEqual(fieldsOf(records), [
    ["a", "b", "c"],
    ["1", "2"],
    ["3", "4", "5", "6"],
  ]);
  assert.deepEqual(
    records.map((r) => r.fields.length),
    [3, 2, 4],
  );
});

test("a field of only whitespace is preserved, not trimmed away", () => {
  assert.deepEqual(fieldsOf(parseCsv('a,b,c\n1,   ,"  "\n')), [
    ["a", "b", "c"],
    ["1", "   ", "  "],
  ]);
});

test("a row of empty fields is a row; a blank line is not", () => {
  assert.deepEqual(fieldsOf(parseCsv("a,b\n\n,\n\n")), [
    ["a", "b"],
    ["", ""],
  ]);
});

test("skipEmptyLines: false reports blank lines as a one-field record", () => {
  assert.deepEqual(fieldsOf(parseCsv("a,b\n\n1,2\n", { skipEmptyLines: false })), [
    ["a", "b"],
    [""],
    ["1", "2"],
  ]);
});

/**
 * RFC-4180 to the letter, and a trap worth pinning: a field only counts as
 * quoted when the quote is its FIRST character, so an exporter that writes
 * `, "x,y"` produces a ragged row rather than three clean fields. Trimming the
 * space first would fix that file and silently corrupt every file with a
 * meaningful leading space, so the split stays visible — the caller reports it
 * as a width mismatch, which is a fixable message, not a wrong value.
 */
test("a space before an opening quote makes the quote literal, and the row ragged", () => {
  assert.deepEqual(fieldsOf(parseCsv('a,b,c\n ,"x,y",z\n')), [
    ["a", "b", "c"],
    [" ", "x,y", "z"],
  ]);
  assert.deepEqual(fieldsOf(parseCsv('a,b,c\n "x,y",z\n'))[1], [' "x', 'y"', "z"]);
});

// The cost of skipEmptyLines, stated: in a one-column file a missing value IS a
// blank line. Callers that sniff `detected: false` should pass false here.
test("a blank row in a single-column file is dropped by default, kept when asked", () => {
  assert.deepEqual(fieldsOf(parseCsv("member_id\n1001\n\n1003\n")), [
    ["member_id"],
    ["1001"],
    ["1003"],
  ]);
  assert.deepEqual(
    fieldsOf(parseCsv("member_id\n1001\n\n1003\n", { skipEmptyLines: false })),
    [["member_id"], ["1001"], [""], ["1003"]],
  );
});

test("a quote inside an unquoted field is literal", () => {
  assert.deepEqual(fieldsOf(parseCsv('item,size\npipe,5" blue\n')), [
    ["item", "size"],
    ["pipe", '5" blue'],
  ]);
});

// One unbalanced quote swallows the rest of the file into a single field, so
// the only symptom is a row count that looks absurdly low. Say why.
test("an unterminated quote is reported instead of silently eating the file", () => {
  const parser = createCsvParser();
  parser.push('a,b\n1,"never closed\n2,also mine\n');
  const tail = parser.flush();
  assert.equal(parser.unterminatedQuote(), true);
  assert.deepEqual(tail[0].fields, ["1", 'never closed\n2,also mine\n']);
});

test("a properly closed file does not report an unterminated quote", () => {
  const parser = createCsvParser();
  parser.push('a\n"closed"\n');
  parser.flush();
  assert.equal(parser.unterminatedQuote(), false);
});

test("an invalid delimiter fails at construction, never on data", () => {
  assert.throws(() => createCsvParser({ delimiter: ";;" }), TypeError);
  assert.throws(() => createCsvParser({ delimiter: '"' }), TypeError);
  assert.throws(() => createCsvParser({ delimiter: "\n" }), TypeError);
});

// ---------------------------------------------------------------------------
// index and line — the two numbers an error message can quote
// ---------------------------------------------------------------------------

test("index counts records and line counts lines, and they diverge on an embedded newline", () => {
  const records = parseCsv('id,note\n1,"two\nlines"\n2,plain\n');
  assert.deepEqual(
    records.map((r) => [r.index, r.line]),
    [
      [0, 1],
      [1, 2],
      [2, 4],
    ],
  );
});

test("skipped blank lines advance the line number but not the record index", () => {
  const records = parseCsv("a\n\n\nb\n");
  assert.deepEqual(
    records.map((r) => [r.index, r.line, r.fields[0]]),
    [
      [0, 1, "a"],
      [1, 4, "b"],
    ],
  );
});

test("line numbers are identical however the input is chunked", () => {
  assertSplitInvariant('id,note\r\n1,"two\r\nlines"\r\n2,plain\r\n');
});

// ---------------------------------------------------------------------------
// Delimiter sniffing
// ---------------------------------------------------------------------------

test("a comma file is detected as comma", () => {
  const sniff = sniffDelimiter("id,name,amount\n1,Juan,5000\n2,Maria,250\n");
  assert.equal(sniff.delimiter, ",");
  assert.equal(sniff.label, "comma");
  assert.equal(sniff.columns, 3);
  assert.equal(sniff.detected, true);
  assert.equal(sniff.consistent, true);
});

// The one that makes this function non-optional: read as comma, this file is one
// column wide and every row fails on "missing required column".
test("a semicolon file is detected as semicolon", () => {
  const sniff = sniffDelimiter("id;name;amount\n1;Juan;5000\n2;Maria;250\n");
  assert.equal(sniff.delimiter, ";");
  assert.equal(sniff.label, "semicolon");
  assert.equal(sniff.columns, 3);
});

test("a tab file is detected as tab", () => {
  const sniff = sniffDelimiter("id\tname\tamount\n1\tJuan\t5000\n");
  assert.equal(sniff.delimiter, "\t");
  assert.equal(sniff.label, "tab");
  assert.equal(sniff.columns, 3);
});

// Counting raw characters would hand this file to the comma parser.
test("a comma inside a leading quoted value is not counted as a delimiter", () => {
  const sniff = sniffDelimiter('"Dela Cruz, Juan";Cebu\n"Reyes, Ana";Davao\n');
  assert.equal(sniff.delimiter, ";");
  assert.equal(sniff.counts[","], 0);
  assert.equal(sniff.counts[";"], 2);
});

/**
 * The limit of quote-awareness, pinned deliberately: quotes are only quotes
 * relative to the CANDIDATE delimiter. Reading this file as comma-delimited,
 * the quote sits mid-field (`1;"Dela Cruz`) and is therefore literal, so the
 * comma inside the name DOES get counted — 2 of them. The pick still lands on
 * semicolon because those commas appear on some rows and not others, so the
 * comma reading is ragged while the semicolon reading is square. Consistency,
 * not the count, is what carries this case.
 */
test("a quoted comma in a non-leading column still loses to the real delimiter", () => {
  const sniff = sniffDelimiter(
    'id;name;city\n1;"Dela Cruz, Juan";Cebu\n2;"Reyes, Ana";Davao\n',
  );
  assert.equal(sniff.delimiter, ";");
  assert.equal(sniff.counts[","], 2);
  assert.equal(sniff.counts[";"], 6);
  assert.equal(sniff.columns, 3);
});

// An UNQUOTED comma in a semicolon file is legal and common. It ties on volume
// with the real delimiter but appears on some rows only, so consistency decides.
test("an unquoted comma on some rows does not steal the vote from the real delimiter", () => {
  const sniff = sniffDelimiter("name;amount\nDela Cruz, Juan;5000\nReyes;250\nSantos;99\n");
  assert.equal(sniff.delimiter, ";");
  assert.equal(sniff.consistent, true);
});

test("a single-column file reports detected: false rather than claiming comma", () => {
  const sniff = sniffDelimiter("member_id\n1001\n1002\n");
  assert.equal(sniff.detected, false);
  assert.equal(sniff.delimiter, ",");
  assert.equal(sniff.columns, 1);
  assert.deepEqual(sniff.counts, { ",": 0, ";": 0, "\t": 0 });
});

test("empty input sniffs to nothing detected instead of throwing", () => {
  const sniff = sniffDelimiter("");
  assert.equal(sniff.detected, false);
  assert.equal(sniff.rows, 0);
});

test("a BOM does not hide the delimiter from the sniffer", () => {
  assert.equal(sniffDelimiter(`${BOM}id;name\n1;Juan\n`).delimiter, ";");
});

test("sniffing a header-only sample still works", () => {
  const sniff = sniffDelimiter("id;name;amount");
  assert.equal(sniff.delimiter, ";");
  assert.equal(sniff.rows, 1);
});

// A sample is a truncated read of a big file, so its last record is usually half
// a row. Judging widths on that half row would report the wrong column count.
test("a sample cut mid-row is judged on its complete rows only", () => {
  const sniff = sniffDelimiter("id;name;amount\n1;Juan;5000\n2;Mar");
  assert.equal(sniff.delimiter, ";");
  assert.equal(sniff.rows, 2);
  assert.equal(sniff.consistent, true);
});

test("the sniffed delimiter is what the parser then needs to be given", () => {
  const text = "id;name\n1;Juan\n";
  const sniff = sniffDelimiter(text);
  assert.deepEqual(fieldsOf(parseCsv(text, { delimiter: sniff.delimiter })), [
    ["id", "name"],
    ["1", "Juan"],
  ]);
});

test("a semicolon file streams across chunk boundaries the same as it parses whole", () => {
  assertSplitInvariant('id;note\n1;"a;b\nc"\n2;plain\n', { delimiter: ";" });
});

// ---------------------------------------------------------------------------
// Property test
// ---------------------------------------------------------------------------

/** Deterministic LCG — a failing seed is reproducible, so this can never flake. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Atoms chosen to be hostile: every delimiter, every line ending, a quote, a surrogate pair. */
const ATOMS = ["a", "Z", "ñ", "₱", "0", " ", "  ", "", ",", ";", "\t", '"', "\n", "\r\n", "\r", "🙂"];

/** RFC-4180 writer — quote when the value holds a delimiter, a quote or a break. */
function writeCsv(rows: string[][], delimiter: string, eol: string): string {
  const cell = (v: string) =>
    v.includes(delimiter) || v.includes('"') || v.includes("\n") || v.includes("\r")
      ? `"${v.replace(/"/g, '""')}"`
      : v;
  return rows.map((row) => row.map(cell).join(delimiter)).join(eol) + eol;
}

/**
 * The generalisation of every boundary case above. Writing a table correctly and
 * reading it back at RANDOM chunk sizes covers the boundary positions no
 * hand-written fixture thinks of — including a cut through a surrogate pair,
 * which survives only because the parser appends code units in order.
 *
 * A row that is a single empty field is excluded: written out it is an empty
 * line, indistinguishable from one by definition, so it is not a round-trip
 * candidate for any parser.
 */
test("randomly generated tables survive the writer and a randomly chunked read", () => {
  let checked = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const r = rng(seed);
    const delimiter = [",", ";", "\t"][Math.floor(r() * 3)];
    const eol = ["\n", "\r\n"][Math.floor(r() * 2)];
    const width = 1 + Math.floor(r() * 4);
    const rows: string[][] = [];
    for (let i = 0; i < 1 + Math.floor(r() * 4); i++) {
      rows.push(
        Array.from({ length: width }, () => {
          let out = "";
          for (let n = Math.floor(r() * 5); n > 0; n--) out += ATOMS[Math.floor(r() * ATOMS.length)];
          return out;
        }),
      );
    }
    if (rows.some((row) => row.length === 1 && row[0] === "")) continue;

    const text = writeCsv(rows, delimiter, eol);
    const parser = createCsvParser({ delimiter, skipEmptyLines: false });
    const got: CsvRecord[] = [];
    for (let i = 0; i < text.length; ) {
      const size = 1 + Math.floor(r() * 9);
      got.push(...parser.push(text.slice(i, i + size)));
      i += size;
    }
    got.push(...parser.flush());

    assert.deepEqual(fieldsOf(got), rows, `seed ${seed} — input ${JSON.stringify(text)}`);
    checked++;
  }
  assert.ok(checked > 300, `expected a meaningful sample, checked ${checked}`);
});
