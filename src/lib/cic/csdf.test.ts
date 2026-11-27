import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCsdfFile,
  buildCsdfFilename,
  buildCsdfFooter,
  buildCsdfHeader,
  csdfBytes,
} from "./csdf";
import { individual, installment } from "./fixtures.test-helpers";
import { formatCicDate, formatCicNumber, formatCicRecord, formatCicText } from "./format";
import { CIC_LAYOUTS } from "./layouts.generated";

// ---- the layouts match the 2016 workbook

test("each record type has the workbook's field count, numbered in order", () => {
  const counts = Object.fromEntries(Object.entries(CIC_LAYOUTS).map(([k, v]) => [k, v.length]));
  assert.deepEqual(counts, { HD: 6, ID: 123, BD: 49, SL: 7, CI: 143, CN: 127, CC: 143, NE: 10, FT: 4 });
  for (const [type, fields] of Object.entries(CIC_LAYOUTS)) {
    fields.forEach((f, i) => assert.equal(f.id, `${type}${i + 1}`));
    assert.equal(fields[0].fixed, type);
  }
});

// ---- §19.4 formats

test("dates are DDMMYYYY", () => {
  assert.equal(formatCicDate("2026-10-31"), "31102026");
  assert.equal(formatCicDate("2026-10-31T16:00:00.000Z"), "31102026");
  assert.equal(formatCicDate(new Date(2026, 0, 5)), "05012026");
  assert.equal(formatCicDate("05012026"), "05012026");
  assert.equal(formatCicDate(null), "");
});

test("numbers are integers with no comma or dot", () => {
  assert.equal(formatCicNumber(4583.33), "4583");
  assert.equal(formatCicNumber("1500.50"), "1501");
  assert.equal(formatCicNumber("12,500"), "12500");
  assert.equal(formatCicNumber(0), "0");
  assert.equal(formatCicNumber(undefined), "");
});

test("text can never shift a position", () => {
  assert.equal(formatCicText("A|B\r\nC"), "A B C");
});

test("every position is written, empty ones included", () => {
  const line = formatCicRecord("ID", individual(), "TEST0001");
  const cells = line.split("|");
  assert.equal(cells.length, 123);
  assert.deepEqual(cells.slice(0, 8), ["ID", "TEST0001", "", "31102026", "M-0001", "", "JUAN", "DELA CRUZ"]);
  assert.equal(cells[122], "");
});

test("the header carries the provider, reference date, version 1.0 and submission type", () => {
  const std = buildCsdfHeader({ providerCode: "TEST0001", fileReferenceDate: "2026-10-31", submissionType: 0 });
  assert.equal(std, "HD|TEST0001|31102026|1.0|0|");
  const corr = buildCsdfHeader({ providerCode: "TEST0001", fileReferenceDate: "2026-10-31", submissionType: 1, comments: "Re-sent" });
  assert.equal(corr, "HD|TEST0001|31102026|1.0|1|Re-sent");
});

test("the footer counts the records between header and footer", () => {
  assert.equal(buildCsdfFooter("TEST0001", "2026-10-31", 3), "FT|TEST0001|31102026|3");
});

test("the filename is stamped with the creation time in Manila, not the reference date", () => {
  // 2026-11-27 16:05:09 UTC is 2026-11-28 00:05:09 in Manila.
  const at = new Date(Date.UTC(2026, 10, 27, 16, 5, 9));
  assert.equal(buildCsdfFilename("TEST0001", at), "TEST0001_CSDF_20261128000509.txt");
});

test("a file is header, records, footer, UTF-8 without a BOM", () => {
  const file = buildCsdfFile({
    providerCode: "TEST0001",
    fileReferenceDate: "2026-10-31",
    submissionType: 0,
    createdAt: new Date(Date.UTC(2026, 10, 1, 0, 0, 0)),
    records: [
      { type: "ID", values: individual({ ID7: "JOSÉ" }) },
      { type: "CI", values: installment() },
    ],
  });
  const lines = file.content.split("\r\n");
  assert.equal(lines.length, 5); // HD, ID, CI, FT and the final line break
  assert.ok(lines[0].startsWith("HD|"));
  assert.ok(lines[1].startsWith("ID|"));
  assert.equal(lines[2].split("|").length, 143);
  assert.equal(lines[3], "FT|TEST0001|31102026|2");
  assert.equal(lines[4], "");
  assert.equal(file.recordCount, 2);
  assert.equal(file.filename, "TEST0001_CSDF_20261101080000.txt");

  const bytes = csdfBytes(file);
  assert.deepEqual([...bytes.slice(0, 2)], [0x48, 0x44]); // "HD", no EF BB BF
  assert.ok(new TextDecoder().decode(bytes).includes("JOSÉ"));
});
