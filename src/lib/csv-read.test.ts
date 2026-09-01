import { test } from "node:test";
import assert from "node:assert/strict";
import { readCsvFile } from "./csv-read";
import { parseCsv } from "./csv-parse";

const BOM = "﻿";
const FFFD = "�";

const csvFile = (text: string, name = "members.csv"): File =>
  new File([new TextEncoder().encode(text)], name, { type: "text/csv" });

const fieldsOf = (records: { fields: string[] }[]) => records.map((r) => r.fields);

/**
 * The way this file is NOT read: each slice decoded on its own. Kept here on
 * purpose so the bug it causes is asserted rather than remembered.
 */
async function readNaively(file: Blob, chunkBytes: number): Promise<string> {
  let text = "";
  for (let offset = 0; offset < file.size; offset += chunkBytes) {
    text += await file.slice(offset, offset + chunkBytes).text();
  }
  return text;
}

// Every UTF-8 width: ñ is 2 bytes, ₱ is 3, the emoji is 4. At small slice sizes
// every one of them is cut in half by a boundary.
const MULTIBYTE = `name,note\nPeña Muñoz,"Santo Niño ₱5,000 🙂"\nBituñgol,"₱1.50 🙂🙂"\n`;

const MULTIBYTE_RECORDS = [
  ["name", "note"],
  ["Peña Muñoz", "Santo Niño ₱5,000 🙂"],
  ["Bituñgol", "₱1.50 🙂🙂"],
];

// ---------------------------------------------------------------------------
// The boundary that corrupts data silently
// ---------------------------------------------------------------------------

/**
 * The headline of this module. One TextDecoder in streaming mode holds an
 * incomplete sequence back and prepends it to the next chunk, so a character
 * split across a slice survives. Read at every small slice size, because the
 * page's real slice size is a constant nobody will revisit and the bug only
 * appears when a boundary lands inside a character.
 */
test("multi-byte characters survive a slice boundary at every chunk size", async () => {
  const file = csvFile(MULTIBYTE);
  for (let chunkBytes = 1; chunkBytes <= 16; chunkBytes++) {
    const result = await readCsvFile(file, { chunkBytes });
    assert.deepEqual(
      fieldsOf(result.records),
      MULTIBYTE_RECORDS,
      `chunkBytes=${chunkBytes} did not round-trip`,
    );
    assert.equal(result.replacementChars, 0, `chunkBytes=${chunkBytes} lost a character`);
    assert.deepEqual(result.notices, []);
  }
});

/**
 * The bug, pinned. This is not hypothetical: it corrupted five characters in a
 * 2.4 MB member export read in 64 KB slices, and the parse still reported the
 * right number of rows, each the right width, with no error raised. Anyone who
 * "simplifies" the reader back to per-slice .text() has to delete this test.
 */
test("reading each slice with .text() instead corrupts those same characters", async () => {
  const file = csvFile(MULTIBYTE);
  const corrupting: number[] = [];
  for (let chunkBytes = 1; chunkBytes <= 16; chunkBytes++) {
    const naive = await readNaively(file, chunkBytes);
    if (naive.includes(FFFD)) corrupting.push(chunkBytes);
  }
  assert.ok(corrupting.length > 0, "expected the naive read to mangle characters");
  assert.equal(corrupting.includes(1), true, "a 1-byte slice must split every ñ, ₱ and emoji");

  // And the damage is invisible downstream: same row count, same widths, only
  // the values are wrong. Nothing but a human reading a name would catch it.
  const naive = parseCsv(await readNaively(file, 1));
  assert.equal(naive.length, MULTIBYTE_RECORDS.length);
  assert.deepEqual(
    naive.map((r) => r.fields.length),
    MULTIBYTE_RECORDS.map((r) => r.length),
  );
  assert.notDeepEqual(fieldsOf(naive), MULTIBYTE_RECORDS);
  assert.equal(naive[1].fields[0].includes(FFFD), true);
});

test("the streamed read matches parsing the whole text in one go", async () => {
  const result = await readCsvFile(csvFile(MULTIBYTE), { chunkBytes: 3 });
  assert.deepEqual(result.records, parseCsv(MULTIBYTE));
});

// The decoder holds a partial sequence back, so a file that ENDS mid-character
// only reveals it when the decoder is flushed — which must happen before the
// parser is flushed, or that text never reaches a record at all.
test("a file truncated mid-character still yields its last row, flagged", async () => {
  const bytes = new TextEncoder().encode("name\nBitu🙂");
  const truncated = new File([bytes.slice(0, bytes.length - 1)], "cut.csv");
  const result = await readCsvFile(truncated, { chunkBytes: 4 });
  assert.deepEqual(fieldsOf(result.records), [["name"], [`Bitu${FFFD}`]]);
  assert.equal(result.replacementChars, 1);
  assert.equal(result.notices[0].code, "not-utf8");
});

test("a BOM split across three 1-byte slices still leaves a clean header", async () => {
  const result = await readCsvFile(csvFile(`${BOM}id,name\n1,Juan\n`), { chunkBytes: 1 });
  assert.deepEqual(fieldsOf(result.records), [
    ["id", "name"],
    ["1", "Juan"],
  ]);
});

// ---------------------------------------------------------------------------
// Notices — file-level, once, never per row
// ---------------------------------------------------------------------------

/**
 * A Windows-1252 export (0xF1 for ñ) arrives already replaced: the bytes are not
 * UTF-8 and no decoder can recover them. The server converts the ORIGINAL bytes,
 * so these rows import correctly — reporting them as bad rows would tell an
 * admin their data is broken when it is not.
 */
test("a non-UTF-8 file is one file-level notice, not a row error", async () => {
  const encode = (s: string) => [...s].map((c) => c.charCodeAt(0));
  const bytes = new Uint8Array([
    ...encode("name,city\n"),
    ...encode("Pe"), 0xf1, ...encode("a,Cebu\n"),
    ...encode("Mu"), 0xf1, ...encode("oz,Davao\n"),
    ...encode("Santo Ni"), 0xf1, ...encode("o,Iloilo\n"),
  ]);
  const result = await readCsvFile(new File([bytes], "cp1252.csv"), { chunkBytes: 5 });

  assert.equal(result.replacementChars, 3);
  assert.equal(result.notices.length, 1, "three bad characters, one notice");
  assert.equal(result.notices[0].code, "not-utf8");
  assert.equal(result.notices[0].severity, "warning", "the rows are still importable");
  assert.match(result.notices[0].message, /CSV UTF-8/);

  // Every row is still here, still the right width, still usable.
  assert.equal(result.records.length, 4);
  assert.deepEqual(
    result.records.map((r) => r.fields.length),
    [2, 2, 2, 2],
  );
  assert.deepEqual(result.records[1].fields, [`Pe${FFFD}a`, "Cebu"]);
});

test("a clean UTF-8 file raises no notices at all", async () => {
  const result = await readCsvFile(csvFile("name,city\nPeña,Cebu\n"));
  assert.deepEqual(result.notices, []);
  assert.equal(result.replacementChars, 0);
  assert.equal(result.unterminatedQuote, false);
});

/**
 * The other silent-plausibility failure: an unbalanced quote swallows the rest
 * of the file into one value, and the only symptom is an implausibly low row
 * count. It comes back as a result field and a notice, so a caller cannot fail
 * to see it by forgetting to ask.
 */
test("an unbalanced quote is a first-class result, not something to remember to ask", async () => {
  const result = await readCsvFile(
    csvFile('id,note\n1,ok\n2,"never closed\n3,swallowed\n'),
    { chunkBytes: 6 },
  );
  assert.equal(result.unterminatedQuote, true);
  assert.equal(result.notices.length, 1);
  assert.equal(result.notices[0].code, "unterminated-quote");
  assert.equal(result.notices[0].severity, "error");
  // The line the user has to open the file to.
  assert.match(result.notices[0].message, /line 3/);
  assert.equal(result.records.length, 3);
});

test("both notices can be reported together", async () => {
  const bytes = new Uint8Array([...[...'a\n"Pe'].map((c) => c.charCodeAt(0)), 0xf1]);
  const result = await readCsvFile(new File([bytes], "both.csv"));
  assert.deepEqual(
    result.notices.map((n) => n.code),
    ["not-utf8", "unterminated-quote"],
  );
  assert.deepEqual(
    result.notices.map((n) => n.severity),
    ["warning", "error"],
  );
});

// ---------------------------------------------------------------------------
// Delimiter, progress, cancellation
// ---------------------------------------------------------------------------

test("the delimiter is detected during the read and reported with its evidence", async () => {
  const result = await readCsvFile(csvFile("id;name\n1;Juan\n2;Maria\n"), { chunkBytes: 7 });
  assert.equal(result.delimiter, ";");
  assert.equal(result.sniff?.detected, true);
  assert.equal(result.sniff?.label, "semicolon");
  assert.deepEqual(fieldsOf(result.records), [
    ["id", "name"],
    ["1", "Juan"],
    ["2", "Maria"],
  ]);
});

// The delimiter used and the delimiter shown to the user come from one place, so
// they cannot disagree — but an explicit choice is honoured and says so.
test("an explicit delimiter is honoured and reports no sniff", async () => {
  const result = await readCsvFile(csvFile("a;b\n1;2\n"), { delimiter: "," });
  assert.equal(result.delimiter, ",");
  assert.equal(result.sniff, null);
  assert.deepEqual(fieldsOf(result.records), [["a;b"], ["1;2"]]);
});

test("progress rises to exactly 1 and the last call carries the final count", async () => {
  const calls: { ratio: number; bytesRead: number; records: number }[] = [];
  const file = csvFile("a,b\n1,2\n3,4\n5,6\n");
  const result = await readCsvFile(file, {
    chunkBytes: 4,
    onProgress: (p) => calls.push({ ratio: p.ratio, bytesRead: p.bytesRead, records: p.records }),
  });

  assert.ok(calls.length > 1, "expected incremental progress, not one call at the end");
  for (let i = 1; i < calls.length; i++) {
    assert.ok(calls[i].bytesRead >= calls[i - 1].bytesRead, "bytesRead went backwards");
  }
  const last = calls[calls.length - 1];
  assert.equal(last.ratio, 1);
  assert.equal(last.bytesRead, file.size);
  assert.equal(last.records, result.records.length, "the last call must include the flushed tail");
});

test("an empty file reports one complete progress call rather than NaN", async () => {
  const calls: number[] = [];
  const result = await readCsvFile(csvFile(""), { onProgress: (p) => calls.push(p.ratio) });
  assert.deepEqual(calls, [1]);
  assert.deepEqual(result.records, []);
  assert.deepEqual(result.notices, []);
  assert.equal(result.delimiter, ",");
});

test("a header-only file reads as one record", async () => {
  const result = await readCsvFile(csvFile("id,name,amount"));
  assert.deepEqual(fieldsOf(result.records), [["id", "name", "amount"]]);
});

test("an already-aborted signal stops the read before any work", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() => readCsvFile(csvFile("a,b\n1,2\n"), { signal: controller.signal }));
});

test("aborting part-way stops the read", async () => {
  const controller = new AbortController();
  await assert.rejects(() =>
    readCsvFile(csvFile("a,b\n1,2\n3,4\n5,6\n7,8\n"), {
      chunkBytes: 4,
      signal: controller.signal,
      onProgress: () => controller.abort(),
    }),
  );
});

test("a real 5,000-row file streams at the default chunk size", async () => {
  let text = `${BOM}member_id,name,address\r\n`;
  for (let i = 1; i <= 5000; i++) {
    text += `${i},"Peña, Juan ${i}","${i} Rizal St.\r\nBarangay Uno"\r\n`;
  }
  const result = await readCsvFile(csvFile(text));
  assert.equal(result.records.length, 5001);
  assert.deepEqual(new Set(result.records.map((r) => r.fields.length)), new Set([3]));
  assert.deepEqual(result.notices, []);
  assert.equal(result.records[1].fields[1], "Peña, Juan 1");
  assert.equal(result.records[1].fields[2], "1 Rizal St.\r\nBarangay Uno");
});
