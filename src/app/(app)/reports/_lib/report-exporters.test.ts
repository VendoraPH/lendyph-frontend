import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import ExcelJS from "exceljs";
import { buildReportWorkbook, toWorksheetName } from "./report-excel";
import { renderReportPdf, toPdfText } from "./report-pdf";
import { renderReportDocx } from "./report-docx";
import { renderReportCsv } from "./report-csv";
import type { FieldItem, KpiItem, ReportDocument } from "./types";

/**
 * Output tests. `report-builders.test.ts` proves the document model is right;
 * everything here reads the bytes the exporters actually emit, because every
 * defect this file was written for passed a model assertion:
 *
 *   - Excel wrote each KPI and `fields` value into a column its own merge then
 *     discarded, so the headline block of all six reports was blank.
 *   - The peso sign has no WinAnsi slot, which made jsPDF re-emit the whole
 *     text run as UTF-16 into a WinAnsi font: every currency figure in all
 *     seventeen reports printed as "+/-352,800.00".
 *   - Excel threw on "Officer / Branch Performance" - an unhandled character in
 *     a worksheet name - so that report had no Excel export at all.
 *   - `KpiItem.hint` reached the preview and none of the four exports.
 */

const CASH_RELEASED = "₱352,800.00";
const PRINCIPAL = "₱370,000.00";
const HINT = `Withheld from ${PRINCIPAL} principal released`;
const EM_DASH = "—";
const EN_DASH = "–";
const NARROW_NBSP = " ";

/**
 * WinAnsi keeps these glyphs in 0x80-0x9F, where Latin-1 has control codes, so
 * a correctly encoded PDF carries each of them as a single high byte.
 */
const WIN_BULLET = String.fromCharCode(0x95);
const WIN_EN_DASH = String.fromCharCode(0x96);
const WIN_EM_DASH = String.fromCharCode(0x97);
const WIN_RIGHT_QUOTE = String.fromCharCode(0x92);

/** Interleaved NUL bytes are the signature of jsPDF's UTF-16 fallback. */
const NUL = String.fromCharCode(0);

/** Every section kind in one document, titled to trip the worksheet-name bug. */
function everySectionDoc(): ReportDocument {
  return {
    reportId: "performance",
    meta: {
      title: "Officer / Branch Performance",
      subtitle: `Aug 1, 2026 ${EN_DASH} Aug 6, 2026`,
      period: `Aug 1, 2026 ${EN_DASH} Aug 6, 2026`,
      generatedAt: "Aug 26, 2026, 8:07 AM",
      org: "Binh's Multi-Purpose Cooperative",
      reference: "PRF-20260826-0807",
      branchLabel: "All Branches",
      preparedBy: "A. Maputol",
    },
    sections: [
      {
        kind: "kpi_grid",
        title: "Headline",
        items: [
          {
            label: "Net Cash Released",
            value: CASH_RELEASED,
            tone: "positive",
            hint: HINT,
          },
          { label: "Loans Released", value: "12", hint: "In the selected period" },
          { label: "Unavailable", value: EM_DASH },
        ],
      },
      {
        kind: "fields",
        title: "Account Particulars",
        items: [
          { label: "Loan Account", value: "LN-2026-0001" },
          { label: "Principal", value: PRINCIPAL },
          { label: "Borrower", value: "Niño Peña" },
        ],
      },
      {
        kind: "table",
        title: "Collections by Officer",
        columns: [
          { key: "officer", header: "Officer" },
          { key: "amount", header: "Collected", format: "currency", align: "right" },
          { key: "rate", header: "Rate", format: "percent", align: "right" },
          { key: "asOf", header: "As Of", format: "date" },
        ],
        rows: [
          { officer: "Niño Peña", amount: 352800, rate: 12.5, asOf: "2026-08-06" },
        ],
        totals: [{ column: "amount", value: CASH_RELEASED }],
      },
      {
        kind: "table",
        title: "Write-offs",
        columns: [{ key: "ref", header: "Reference" }],
        rows: [],
        emptyText: "No write-offs in this period.",
      },
      { kind: "note", text: `Auto-generated ${EM_DASH} figures as of export.` },
      { kind: "signatures", roles: ["Prepared by", "Certified correct by"] },
    ],
  };
}

function kpiItems(doc: ReportDocument): KpiItem[] {
  return doc.sections.flatMap((s) => (s.kind === "kpi_grid" ? s.items : []));
}

function fieldItems(doc: ReportDocument): FieldItem[] {
  return doc.sections.flatMap((s) => (s.kind === "fields" ? s.items : []));
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

/**
 * Write the workbook out and read the real .xlsx back. Asserting on the
 * in-memory model would have passed while the file was blank: the value was
 * assigned to a cell that `mergeCells` then discarded.
 */
async function readBackSheet(doc: ReportDocument): Promise<ExcelJS.Worksheet> {
  const buffer = await buildReportWorkbook(doc).xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(buffer as ArrayBuffer);
  const sheet = reopened.worksheets[0];
  assert.ok(sheet, "workbook came back with no worksheet");
  return sheet;
}

/** The label band is merged A:C, so a hint rides in the label cell's 2nd line. */
function rowForLabel(sheet: ExcelJS.Worksheet, label: string): ExcelJS.Row {
  let found: ExcelJS.Row | undefined;
  sheet.eachRow((row) => {
    if (row.getCell(1).text.split("\n")[0] === label) found = row;
  });
  assert.ok(found, `no row labelled "${label}" in the sheet`);
  return found;
}

test("excel: every KPI value survives into its own addressable cell", async () => {
  const doc = everySectionDoc();
  const sheet = await readBackSheet(doc);

  for (const item of kpiItems(doc)) {
    const row = rowForLabel(sheet, item.label);
    // Column D is the master of the value band (D:G). Column B looks like the
    // value column but sits inside the label's merge and is thrown away.
    assert.equal(
      row.getCell(4).text,
      item.value,
      `KPI "${item.label}" lost its value on export`
    );
    assert.notEqual(
      row.getCell(4).text,
      row.getCell(1).text,
      `KPI "${item.label}" only echoed its label`
    );
  }
});

test("excel: every fields value survives into its own addressable cell", async () => {
  const doc = everySectionDoc();
  const sheet = await readBackSheet(doc);

  for (const item of fieldItems(doc)) {
    assert.equal(
      rowForLabel(sheet, item.label).getCell(4).text,
      item.value,
      `field "${item.label}" lost its value on export`
    );
  }
});

test("excel: KPI hints reach the sheet instead of stopping at the preview", async () => {
  const doc = everySectionDoc();
  const sheet = await readBackSheet(doc);

  for (const item of kpiItems(doc)) {
    if (!item.hint) continue;
    assert.ok(
      rowForLabel(sheet, item.label).getCell(1).text.includes(item.hint),
      `KPI "${item.label}" dropped its hint`
    );
  }
});

test("excel: a title containing a slash exports instead of throwing", async () => {
  const doc = everySectionDoc();
  assert.match(doc.meta.title, /\//, "fixture must exercise the crash");

  const sheet = await readBackSheet(doc);
  assert.doesNotMatch(
    sheet.name,
    /[*?:\\/[\]]/,
    "sheet name kept a character Excel refuses"
  );
  assert.ok(sheet.name.length <= 31, "sheet name exceeds Excel's 31-character cap");
});

test("toWorksheetName strips Excel's whole forbidden set", () => {
  assert.equal(
    toWorksheetName("Officer / Branch Performance"),
    "Officer - Branch Performance"
  );
  assert.equal(toWorksheetName("Due / Past Due List"), "Due - Past Due List");
  assert.equal(toWorksheetName("A*B?C:D\\E/F[G]H"), "A-B-C-D-E-F-G-H");
  assert.equal(toWorksheetName("Aging Report"), "Aging Report");

  // Capped at 31, and never left trailing on a separator the slice cut into.
  const long = "Consolidated Portfolio / Product Movement Summary";
  assert.equal(toWorksheetName(long).length, 31);
  assert.doesNotMatch(toWorksheetName(long), /[-\s]$/);

  // Excel also refuses a name that opens or closes on an apostrophe.
  assert.equal(toWorksheetName("'Quoted'"), "Quoted");

  // Nothing usable left, and Excel's own reserved sheet name.
  assert.equal(toWorksheetName("///"), "Report");
  assert.equal(toWorksheetName(""), "Report");
  assert.equal(toWorksheetName("History"), "Report");
});

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/**
 * Pull the text-showing operands out of the rendered PDF. jsPDF leaves content
 * streams uncompressed, so this is what a viewer will actually draw.
 */
function pdfTextOperands(doc: ReportDocument): string[] {
  const bytes = Buffer.from(renderReportPdf(doc).output("arraybuffer"));
  const raw = bytes.toString("latin1");
  const shown = raw.match(/\((?:\\.|[^()\\])*\)\s*Tj/g) ?? [];
  const operands = shown.map((op) => op.slice(1, op.lastIndexOf(")")));
  // Guard against a vacuous pass: if jsPDF ever starts compressing its content
  // streams, every assertion below would silently hold against an empty list.
  assert.ok(operands.length > 0, "no drawable text found in the PDF");
  return operands;
}

test("toPdfText encodes into WinAnsi rather than dropping or mangling", () => {
  // No standard-14 font has a peso glyph, so it becomes its ISO 4217 code.
  assert.equal(toPdfText(CASH_RELEASED), "PHP 352,800.00");
  assert.equal(toPdfText("₱ 100"), "PHP 100", "an existing space is swallowed");

  // These do have WinAnsi slots, in the range Latin-1 leaves to control codes.
  assert.equal(toPdfText(EM_DASH), WIN_EM_DASH);
  assert.equal(toPdfText(EN_DASH), WIN_EN_DASH);
  assert.equal(toPdfText("•"), WIN_BULLET);
  assert.equal(toPdfText("’"), WIN_RIGHT_QUOTE);

  // Latin-1 passes through untouched, and the transform is idempotent.
  assert.equal(toPdfText("Niño Peña"), "Niño Peña");
  assert.equal(toPdfText(toPdfText(CASH_RELEASED)), "PHP 352,800.00");

  // Anything else folds to a Latin-1 base, or to a visible placeholder: a
  // wrong glyph gets reported, a silently missing one does not.
  assert.equal(toPdfText("Ā"), "A", "A-macron folds to its base letter");
  assert.equal(
    toPdfText(`8:07${NARROW_NBSP}AM`),
    "8:07 AM",
    "a narrow no-break space folds to a plain space"
  );
  assert.equal(toPdfText("中"), "?", "an unrepresentable glyph stays visible");
});

test("pdf: peso figures print as PHP, never as the plus-minus mojibake", () => {
  const joined = pdfTextOperands(everySectionDoc()).join("\n");

  assert.ok(joined.includes("PHP 352,800.00"), "KPI currency missing from the PDF");
  assert.ok(joined.includes("PHP 370,000.00"), "fields currency missing from the PDF");
  assert.ok(
    !joined.includes("±"),
    "a peso sign reached the page as UTF-16 and renders as plus-minus"
  );
});

test("pdf: no text run falls back to UTF-16", () => {
  // The root cause, asserted directly. jsPDF re-emits an entire string as
  // UTF-16 the moment one character has no WinAnsi slot, and the font still
  // reads those bytes as WinAnsi — so a lone ₱ took the whole line with it.
  // Interleaved NUL bytes are that fallback's signature.
  for (const operand of pdfTextOperands(everySectionDoc())) {
    assert.ok(
      !operand.includes(NUL),
      `text run fell back to UTF-16: ${JSON.stringify(operand)}`
    );
  }
});

test("pdf: WinAnsi punctuation keeps its glyph instead of folding away", () => {
  const joined = pdfTextOperands(everySectionDoc()).join("\n");

  // These are representable, so the transcode must pass them through as their
  // WinAnsi byte rather than sweep them up with the unrepresentable and print
  // a "?" where the em dash placeholder and the footer bullet should be.
  assert.ok(joined.includes(WIN_EM_DASH), "em dash lost its glyph");
  assert.ok(joined.includes(WIN_EN_DASH), "en dash lost its glyph");
  assert.ok(joined.includes(WIN_BULLET), "footer bullet lost its glyph");
});

test("pdf: KPI hints are drawn on the card", () => {
  const joined = pdfTextOperands(everySectionDoc()).join("\n");
  assert.ok(
    joined.includes("Withheld from PHP 370,000.00 principal released"),
    "KPI hint missing from the PDF"
  );
});

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

/**
 * Minimal zip entry reader. A .docx keeps its text in a deflated entry, and the
 * app carries no zip library of its own to borrow for the assertion.
 */
function readZipEntry(zip: Buffer, name: string): string {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.notEqual(eocd, -1, "not a zip archive");
  const entryCount = zip.readUInt16LE(eocd + 10);
  let cursor = zip.readUInt32LE(eocd + 16);

  for (let i = 0; i < entryCount; i++) {
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const entryName = zip.toString("utf8", cursor + 46, cursor + 46 + nameLength);

    if (entryName === name) {
      const method = zip.readUInt16LE(cursor + 10);
      const compressedSize = zip.readUInt32LE(cursor + 20);
      const localHeader = zip.readUInt32LE(cursor + 42);
      const start =
        localHeader +
        30 +
        zip.readUInt16LE(localHeader + 26) +
        zip.readUInt16LE(localHeader + 28);
      const data = zip.subarray(start, start + compressedSize);
      return (method === 0 ? data : inflateRawSync(data)).toString("utf8");
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`zip entry "${name}" not found`);
}

async function docxBody(doc: ReportDocument): Promise<string> {
  const blob = await renderReportDocx(doc);
  return readZipEntry(Buffer.from(await blob.arrayBuffer()), "word/document.xml");
}

test("docx: KPI and fields values, and KPI hints, reach the document body", async () => {
  const doc = everySectionDoc();
  const xml = await docxBody(doc);

  for (const item of kpiItems(doc)) {
    assert.ok(xml.includes(item.value), `KPI "${item.label}" lost its value`);
    if (item.hint) {
      assert.ok(xml.includes(item.hint), `KPI "${item.label}" dropped its hint`);
    }
  }
  for (const item of fieldItems(doc)) {
    assert.ok(xml.includes(item.value), `field "${item.label}" lost its value`);
  }
});

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

test("csv: KPI hints get a Note column alongside the value", () => {
  const doc = everySectionDoc();
  const csv = renderReportCsv(doc);

  assert.ok(
    csv.includes("Metric,Value,Note"),
    "a hinted KPI block kept the two-column header"
  );
  assert.ok(
    csv.includes(`Net Cash Released,"${CASH_RELEASED}","${HINT}"`),
    "KPI row did not carry label, value and hint together"
  );
  for (const item of fieldItems(doc)) {
    assert.ok(csv.includes(item.value), `field "${item.label}" lost its value`);
  }
});

test("csv: a KPI block with no hints keeps its two-column shape", () => {
  const csv = renderReportCsv({
    ...everySectionDoc(),
    sections: [
      {
        kind: "kpi_grid",
        title: "Headline",
        items: [{ label: "Active Loans", value: "42" }],
      },
    ],
  });

  assert.ok(csv.includes("Metric,Value\r\nActive Loans,42"));
  assert.ok(!csv.includes("Note"));
});

// ---------------------------------------------------------------------------
// All four
// ---------------------------------------------------------------------------

test("a report carrying every section kind exports in all four formats", async () => {
  const doc = everySectionDoc();
  const kinds = new Set(doc.sections.map((s) => s.kind));
  for (const kind of ["kpi_grid", "table", "fields", "note", "signatures"] as const) {
    assert.ok(kinds.has(kind), `fixture is missing a "${kind}" section`);
  }

  await assert.doesNotReject(() => buildReportWorkbook(doc).xlsx.writeBuffer());
  await assert.doesNotReject(() => renderReportDocx(doc));
  assert.doesNotThrow(() => renderReportPdf(doc).output("arraybuffer"));
  assert.doesNotThrow(() => renderReportCsv(doc));
});
