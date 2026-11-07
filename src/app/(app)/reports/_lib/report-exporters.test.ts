import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import ExcelJS from "exceljs";
import { buildReportWorkbook, toWorksheetName } from "./report-excel";
import { PESO_SLOT, renderReportPdf, toPdfText } from "./report-pdf";
import { renderReportDocx } from "./report-docx";
import { renderReportCsv } from "./report-csv";
import { buildStatementOfAccountDoc } from "./report-builders";
import { formatValue } from "@/lib/report-format";
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

test("excel: a stored rate keeps its places instead of one decimal", async () => {
  const doc: ReportDocument = {
    ...everySectionDoc(),
    sections: [
      {
        kind: "table",
        title: "Releases",
        columns: [
          { key: "loan", header: "Loan" },
          { key: "interest_rate", header: "Rate", format: "rate", align: "right" },
        ],
        rows: [{ loan: "LN-2026-0001", interest_rate: "1.1250" }],
      },
    ],
  };
  const cell = rowForLabel(await readBackSheet(doc), "LN-2026-0001").getCell(2);

  assert.equal(cell.value, 0.01125);
  // "0.0%" would show 1.1%; this shows 1.125%, and 3 still as 3.0%.
  assert.equal(cell.numFmt, "0.0###%");
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
function pdfRaw(doc: ReportDocument): string {
  return Buffer.from(renderReportPdf(doc).output("arraybuffer")).toString("latin1");
}

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
  // No standard-14 font has a peso glyph, so the text holds its slot, and the
  // sign is drawn into it from its own small font.
  assert.equal(toPdfText(CASH_RELEASED), `${PESO_SLOT}352,800.00`);
  assert.equal(toPdfText("₱ 100"), `${PESO_SLOT}100`, "an existing space is swallowed");

  // These do have WinAnsi slots, in the range Latin-1 leaves to control codes.
  assert.equal(toPdfText(EM_DASH), WIN_EM_DASH);
  assert.equal(toPdfText(EN_DASH), WIN_EN_DASH);
  assert.equal(toPdfText("•"), WIN_BULLET);
  assert.equal(toPdfText("’"), WIN_RIGHT_QUOTE);

  // Latin-1 passes through untouched, and the transform is idempotent.
  assert.equal(toPdfText("Niño Peña"), "Niño Peña");
  assert.equal(toPdfText(toPdfText(CASH_RELEASED)), `${PESO_SLOT}352,800.00`);

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

test("finding 21: peso figures print the sign, never PHP or the plus-minus mojibake", () => {
  const raw = pdfRaw(everySectionDoc());
  const joined = pdfTextOperands(everySectionDoc()).join("\n");

  assert.ok(joined.includes("352,800.00"), "KPI currency missing from the PDF");
  assert.ok(joined.includes("370,000.00"), "fields currency missing from the PDF");
  assert.ok(!joined.includes("PHP"), "still prints PHP");
  assert.ok(!joined.includes(PESO_SLOT), "the slot reached the page instead of the sign");
  assert.ok(
    !joined.includes("±"),
    "a peso sign reached the page as UTF-16 and renders as plus-minus"
  );
  assert.ok(raw.includes("/FontFile2"), "the sign's font is not embedded");
  assert.ok(raw.includes("/ToUnicode"), "the sign can't be copied or searched");
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
    joined.includes("Withheld from ") && joined.includes("370,000.00 principal released"),
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

// ---------------------------------------------------------------------------
// Statement of Account (round fx, D3): every output carries the same statement
// ---------------------------------------------------------------------------

const AS_OF_LINE = `As of ${formatValue("2026-11-05", "date")}`;

function statementDoc(): ReportDocument {
  return buildStatementOfAccountDoc(
    {
      as_of: "2026-11-05",
      schedule_note: "A balance adjustment restated this schedule.",
      loan: { loan_account_number: "LN-000004", status: "ongoing", status_label: "Past Due", has_build_up: true },
      borrower: { full_name: "Eduardo Mendoza" },
      summary: { outstanding_balance: 32800, overdue_amount: 3000, total_paid: 3000 },
      amortization_schedule: [
        { period_number: 1, due_date: "2026-12-05", principal_due: 1000, interest_due: 300, penalty_amount: 20, total_due: 1320, build_up_due: 100, total_payment: 1420 },
      ],
      schedule_totals: { total_due: 1320, build_up_due: 100, total_payment: 1420 },
      transactions: [
        { type: "payment", date: "2026-11-05", receipt_number: "RCP-000012", payment_method: "GCash", reference_number: "GC12345678", particulars: "Payment RCP-000012", credit: 1000, principal_applied: 700, interest_applied: 200, penalty_applied: 50, insurance_applied: 25, build_up_applied: 25, principal_balance: 11300 },
      ],
    },
    { from: "2026-10-01", to: "2026-10-31" }
  );
}

/** Text every output has to carry; the Period the date filter printed is gone. */
function assertStatementText(output: string): void {
  assert.ok(output.includes(AS_OF_LINE), `missing "${AS_OF_LINE}"`);
  assert.ok(!output.includes("Period:"), "still prints a Period line");
  assert.ok(!output.includes("Oct 1, 2026"), "still prints the picked date range");
  for (const text of [
    "Principal Balance",
    "Share Capital Build-Up",
    "Total Payment",
    "Build-Up",
    "GCash (Ref. GC12345678)",
    "Past Due",
    "A balance adjustment restated this schedule.",
  ]) {
    assert.ok(output.includes(text), `missing "${text}"`);
  }
}

test("statement csv: As of, split columns, reference and schedule note", () => {
  assertStatementText(renderReportCsv(statementDoc()));
});

test("statement docx: As of, split columns, reference and schedule note", async () => {
  assertStatementText(await docxBody(statementDoc()));
});

test("statement docx: a compact table prints in the smaller type, and others keep theirs", async () => {
  assert.ok((await docxBody(statementDoc())).includes('w:sz w:val="15"'));
  assert.ok(!(await docxBody(everySectionDoc())).includes('w:sz w:val="15"'));
});

test("statement pdf: As of, split columns, reference and schedule note", () => {
  // Drawn runs can wrap, so words are compared with the line breaks closed up.
  const flat = pdfTextOperands(statementDoc()).join(" ").replace(/\s+/g, " ");
  assert.ok(flat.includes(AS_OF_LINE), flat);
  assert.ok(!flat.includes("Period:"));
  assert.ok(!flat.includes("Oct 1, 2026"));
  for (const text of ["Principal", "Build-Up", "Total", "GCash", "GC12345678", "Past Due", "restated this schedule"]) {
    assert.ok(flat.includes(text), `missing "${text}"`);
  }
});

test("statement pdf: a build-up loan's twelve columns never break a word or a figure", () => {
  const doc = statementDoc();
  const schedule = doc.sections.find((s) => s.kind === "table" && s.title === "Amortization Schedule");
  assert.ok(schedule && schedule.kind === "table");
  // Seven figures in the widest cells, and a status the old width split in two.
  const wide = {
    ...doc,
    sections: doc.sections.map((s) =>
      s === schedule
        ? {
            ...schedule,
            rows: [
              { ...schedule.rows[0], beginning_balance: 1080000, principal_due: 92000.54, interest_due: 27000.43, penalty_amount: 1210.85, total_due: 120211.82, build_up_due: 1000, total_payment: 121211.82, total_paid: 119000.97, balance: 120211.82, status: "overdue" },
            ],
            // Seven figures in every footer cell are what squeeze the narrow columns.
            totals: schedule.totals?.map((t) => ({ ...t, value: "₱1,442,541.84" })),
          }
        : s
    ),
  };
  const operands = pdfTextOperands(wide);

  for (const whole of ["Period", "overdue", "1,080,000.00", "1,442,541.84"]) {
    assert.ok(operands.some((o) => o.includes(whole)), `"${whole}" was broken across lines`);
  }
});

/** The statement with an overpaid line, and the server's total for it. */
function overpaidStatementDoc(): ReportDocument {
  return buildStatementOfAccountDoc(
    {
      as_of: "2026-11-05",
      loan: { loan_account_number: "LN-000004", has_build_up: true },
      amortization_schedule: [
        { period_number: 1, due_date: "2026-12-05", beginning_balance: 1080000, principal_due: 92000.54, interest_due: 27000.43, penalty_amount: 1210.85, total_due: 120211.82, build_up_due: 1000, total_payment: 121211.82, total_paid: 119000.97, amount_remaining: 120211.82, status: "overdue" },
      ],
      transactions: [
        { type: "payment", date: "2026-11-05", receipt_number: "RCP-000012", payment_method: "Bank Transfer", reference_number: "GC1234567890123", particulars: "Payment RCP-000012", credit: 121211.82, principal_applied: 92000.54, interest_applied: 27000.43, penalty_applied: 1210.85, insurance_applied: 0, build_up_applied: 1000, overpayment_applied: 150.5, principal_balance: 987999.46 },
      ],
      transaction_totals: { debit: 0, credit: 121211.82, overpayment_applied: 900.25 },
    },
    { from: "2026-10-01", to: "2026-10-31" }
  );
}

test("the Overpayment column and its total reach every export, and stay out when there is none", async () => {
  const overpaid = overpaidStatementDoc();
  const plain = statementDoc();

  const csv = renderReportCsv(overpaid);
  assert.ok(csv.includes("Overpayment") && csv.includes("₱150.50") && csv.includes("₱900.25"), "csv");
  assert.ok(!renderReportCsv(plain).includes("Overpayment"), "csv without one");

  const docx = await docxBody(overpaid);
  assert.ok(docx.includes("Overpayment") && docx.includes("₱150.50") && docx.includes("₱900.25"), "docx");
  assert.ok(!(await docxBody(plain)).includes("Overpayment"), "docx without one");

  const pdf = pdfTextOperands(overpaid).join(" ");
  assert.ok(pdf.includes("Overpayment") && pdf.includes("150.50") && pdf.includes("900.25"), "pdf");
  assert.ok(!pdfTextOperands(plain).join(" ").includes("Overpayment"), "pdf without one");

  const cellsOf = async (doc: ReportDocument) => {
    const sheet = await readBackSheet(doc);
    const cells: string[] = [];
    sheet.eachRow((row) => row.eachCell((cell) => cells.push(String(cell.value))));
    return cells;
  };
  const excel = await cellsOf(overpaid);
  assert.ok(excel.includes("Overpayment"), "excel header");
  assert.ok(excel.includes("150.5"), "excel figure");
  assert.ok(excel.some((c) => c.includes("900.25")), "excel total");
  assert.ok(!(await cellsOf(plain)).includes("Overpayment"), "excel without one");
});

test("statement pdf: thirteen columns never break a word or a figure", () => {
  const operands = pdfTextOperands(overpaidStatementDoc());
  for (const whole of ["Overpayment", "Build-Up", "121,211.82", "987,999.46", "RCP-000012"]) {
    assert.ok(operands.some((o) => o.includes(whole)), `"${whole}" was broken across lines`);
  }
});

test("statement excel: As of, split columns, reference and schedule note", async () => {
  const sheet = await readBackSheet(statementDoc());
  const cells: string[] = [];
  sheet.eachRow((row) => row.eachCell((cell) => cells.push(String(cell.value))));
  assertStatementText(cells.join("\n"));
});

test("every other report keeps Period in every output", async () => {
  const doc = everySectionDoc();
  const period = `Period: ${doc.meta.period}`;
  assert.ok(renderReportCsv(doc).includes(period));
  assert.ok((await docxBody(doc)).includes(period));
  const sheet = await readBackSheet(doc);
  const cells: string[] = [];
  sheet.eachRow((row) => row.eachCell((cell) => cells.push(String(cell.value))));
  assert.ok(cells.some((c) => c.includes("Period: ")));
});

// ---------------------------------------------------------------------------
// Statement of Account (round fz): layout and output findings
// ---------------------------------------------------------------------------

/** A money table long enough to run over several pages. */
function longTableDoc(rowCount: number): ReportDocument {
  return {
    reportId: "statement_of_account",
    meta: { title: "Statement of Account", generatedAt: "Nov 5, 2026", org: "Coop", reference: "SOA-LN-1-20261105-0912" },
    sections: [
      {
        kind: "table",
        title: "Amortization Schedule",
        columns: [
          { key: "period", header: "Period", format: "number", align: "center" },
          { key: "amount", header: "Amount", format: "currency", align: "right" },
        ],
        rows: Array.from({ length: rowCount }, (_, i) => ({ period: i + 1, amount: 100 })),
        totals: [{ column: "amount", value: "₱1,000,000.00" }],
      },
      { kind: "signatures", roles: ["Prepared by"] },
    ],
  };
}

/** Each page's drawing commands, in order. */
function pdfPages(doc: ReportDocument): string[] {
  const pdf = renderReportPdf(doc);
  const count = pdf.getNumberOfPages();
  const pages = (pdf.internal as unknown as { pages: string[][] }).pages;
  return Array.from({ length: count }, (_, i) => pages[i + 1].join("\n"));
}

/** Where a drawn run starts: its x, read off the Td just before it. */
function pdfRunX(doc: ReportDocument, text: string): number[] {
  const raw = pdfPages(doc).join("\n");
  const found: number[] = [];
  const pattern = /(-?[\d.]+) -?[\d.]+ Td\s*\(((?:\\.|[^()\\])*)\) Tj/g;
  for (const match of raw.matchAll(pattern)) {
    if (match[2] === text) found.push(Number(match[1]));
  }
  return found;
}

test("finding 22: a table over several pages prints its total once, on the last page", () => {
  const pages = pdfPages(longTableDoc(90));
  assert.ok(pages.length >= 3, `expected several pages, got ${pages.length}`);
  const withTotal = pages.flatMap((page, i) => (page.includes("(Total) Tj") ? [i] : []));
  // Once, under the table's last row; the signature may follow on its own page.
  const lastRowPage = pages.findIndex((page) => page.includes("(90) Tj"));
  assert.deepEqual(withTotal, [lastRowPage]);
});

test("finding 22: totals sit right-aligned under right-aligned figures", () => {
  const doc = longTableDoc(2);
  const [totalX] = pdfRunX(doc, "1,000,000.00");
  const [cellX] = pdfRunX(doc, "100.00");
  assert.ok(totalX !== undefined && cellX !== undefined, "figures not found");
  // Left-aligned they would start at the same x; right-aligned the longer one starts earlier.
  assert.ok(totalX < cellX, `total starts at ${totalX}, a cell at ${cellX}`);
});

test("finding 23: whatever the length, the PDF ends on the signature, never a blank page", () => {
  for (let rows = 1; rows <= 60; rows++) {
    const pages = pdfPages(longTableDoc(rows));
    assert.ok(pages[pages.length - 1].includes("(Prepared by) Tj"), `${rows} rows end on a page with no signature`);
  }
});

test("finding 24: a long name wraps inside its box and clears its label", () => {
  const long = "Maria Concepcion Evangelista de los Santos Villanueva-Dimaculangan y Fernandez Jr III";
  const doc: ReportDocument = {
    reportId: "statement_of_account",
    meta: { title: "Statement of Account", generatedAt: "", org: "" },
    sections: [
      {
        kind: "fields",
        title: "Account Particulars",
        items: [
          { label: "Member", value: long },
          { label: "Status", value: "Current" },
          { label: "Loan Account No.", value: "LN-000001" },
        ],
      },
    ],
  };
  const pages = pdfPages(doc).join("\n");
  assert.ok(!pages.includes(`(${long}) Tj`), "the name was drawn on one line");

  const runs = [...pages.matchAll(/(-?[\d.]+) -?[\d.]+ Td\s*\(((?:\\.|[^()\\])*)\) Tj/g)].map((m) => ({
    x: Number(m[1]),
    text: m[2],
  }));
  const pdf = renderReportPdf(doc);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const labelEnd = runs.find((r) => r.text === "Member")!.x + pdf.getTextWidth("Member");
  pdf.setFont("helvetica", "bold");
  const nameLines = runs.filter((r) => long.includes(r.text) && r.text.length > 6);
  assert.ok(nameLines.length >= 2, "expected the name on two lines or more");
  const middle = pdf.internal.pageSize.getWidth() / 2;
  for (const line of nameLines) {
    assert.ok(line.x > labelEnd, `"${line.text}" runs over the label`);
    assert.ok(line.x + pdf.getTextWidth(line.text) <= middle, `"${line.text}" runs out of its column`);
  }
  // The row below starts under the name's last line.
  const nameYs = [...pages.matchAll(/-?[\d.]+ (-?[\d.]+) Td\s*\(((?:\\.|[^()\\])*)\) Tj/g)];
  const lastNameY = Math.min(...nameYs.filter((m) => long.includes(m[2]) && m[2].length > 6).map((m) => Number(m[1])));
  const nextRowY = Number(nameYs.find((m) => m[2] === "Loan Account No.")![1]);
  assert.ok(nextRowY < lastNameY, "the next row overlaps the wrapped name");
});

test("finding 27: a KPI hint prints in italics in the PDF", () => {
  const raw = pdfPages(everySectionDoc()).join("\n");
  const at = raw.indexOf("(In the selected period) Tj");
  assert.ok(at > 0, "hint not found");
  const before = raw.slice(0, at);
  const font = before.slice(before.lastIndexOf("/F"), before.lastIndexOf(" Tf"));

  const pdf = renderReportPdf(everySectionDoc());
  pdf.setFont("helvetica", "italic");
  const italicKey = (pdf.getFont() as unknown as { id: string }).id;
  assert.ok(font.startsWith(`${italicKey.startsWith("/") ? "" : "/"}${italicKey} `), `hint drawn in ${font}`);
});

test("finding 28: name, date and Received by reach every output", async () => {
  const doc: ReportDocument = {
    ...everySectionDoc(),
    sections: [{ kind: "signatures", roles: ["Prepared by", "Received by (Member)"], lines: ["Name", "Date"] }],
  };
  const csv = renderReportCsv(doc);
  assert.ok(csv.includes("Received by (Member)") && csv.includes("Received by (Member): Name") && csv.includes("Prepared by: Date"), "csv");

  const docx = await docxBody(doc);
  assert.ok(docx.includes("Received by (Member)") && docx.includes("Name:") && docx.includes("Date:"), "docx");

  const pdf = pdfTextOperands(doc);
  for (const text of ["Received by (Member)".replace(/[()]/g, "\\$&"), "Name:", "Date:"]) {
    assert.ok(pdf.some((o) => o.includes(text)), `pdf: ${text}`);
  }

  const sheet = await readBackSheet(doc);
  const cells: string[] = [];
  sheet.eachRow((row) => row.eachCell((cell) => cells.push(String(cell.value))));
  for (const text of ["Received by (Member)", "Name:", "Date:"]) {
    assert.ok(cells.includes(text), `excel: ${text}`);
  }
});

test("a sign-off without lines keeps its old shape", async () => {
  const docx = await docxBody(everySectionDoc());
  assert.ok(!docx.includes("Name:"));
  assert.ok(!renderReportCsv(everySectionDoc()).includes("Prepared by: Name"));
});

test("finding 29: excel carries the reference and the generated date", async () => {
  const doc = { ...everySectionDoc(), meta: { ...everySectionDoc().meta, generatedAt: "Nov 5, 2026, 9:12 AM" } };
  const sheet = await readBackSheet(doc);
  const cells: string[] = [];
  sheet.eachRow((row) => row.eachCell((cell) => cells.push(String(cell.value))));
  assert.ok(cells.includes(`Reference: ${doc.meta.reference}`), "no reference");
  assert.ok(cells.includes("Generated: Nov 5, 2026, 9:12 AM"), "no generated date");
  assert.ok(cells.includes(`Prepared by: ${doc.meta.preparedBy}`), "no preparer");
});

test("finding 29: excel stores money totals as numbers, and a dash stays a dash", async () => {
  const doc: ReportDocument = {
    ...everySectionDoc(),
    sections: [
      {
        kind: "table",
        columns: [
          { key: "label", header: "Label" },
          { key: "amount", header: "Amount", format: "currency", align: "right" },
          { key: "missing", header: "Missing", format: "currency", align: "right" },
          { key: "share", header: "Share", format: "percent", align: "right" },
        ],
        rows: [{ label: "A", amount: 1, missing: 1, share: 1 }],
        totals: [
          { column: "amount", value: "₱1,234,567.89" },
          { column: "missing", value: EM_DASH },
          { column: "share", value: "100.0%" },
        ],
      },
    ],
  };
  const row = rowForLabel(await readBackSheet(doc), "Total");
  assert.equal(row.getCell(2).value, 1234567.89);
  assert.equal(row.getCell(2).numFmt, '"₱"#,##0.00;[Red]-"₱"#,##0.00');
  assert.equal(row.getCell(3).value, EM_DASH);
  assert.equal(row.getCell(4).value, "100.0%");
});

test("finding 18: the organization's address and contact reach every output", async () => {
  const doc = {
    ...everySectionDoc(),
    meta: { ...everySectionDoc().meta, orgAddress: "Butuan City", orgContact: "0917 000 0000" },
  };
  const line = `Butuan City  •  0917 000 0000`;
  assert.ok(renderReportCsv(doc).includes(line), "csv");
  assert.ok((await docxBody(doc)).includes(line), "docx");
  const pdf = pdfTextOperands(doc).join("\n");
  assert.ok(pdf.includes("Butuan City") && pdf.includes("0917 000 0000"), "pdf");
  const sheet = await readBackSheet(doc);
  const cells: string[] = [];
  sheet.eachRow((r) => r.eachCell((c) => cells.push(String(c.value))));
  assert.ok(cells.includes(line), "excel");
});

test("finding 12: a voided line reads muted in the PDF and Excel", async () => {
  const doc: ReportDocument = {
    ...everySectionDoc(),
    sections: [
      {
        kind: "table",
        columns: [
          { key: "particulars", header: "Particulars" },
          { key: "credit", header: "Credit", format: "currency", align: "right" },
        ],
        rows: [
          { particulars: "Payment A", credit: 1, voided: false },
          { particulars: "Payment B (Voided)", credit: 2, voided: true },
        ],
      },
    ],
  };
  const raw = pdfPages(doc).join("\n");
  const colorBefore = (text: string) => {
    const at = raw.indexOf(`(${text}) Tj`);
    assert.ok(at > 0, `${text} not drawn`);
    return [...raw.slice(0, at).matchAll(/([\d. ]+) (?:rg|g)\n/g)].at(-1)?.[1];
  };
  assert.notEqual(colorBefore("Payment B \\(Voided\\)"), colorBefore("Payment A"));

  const sheet = await readBackSheet(doc);
  assert.equal(rowForLabel(sheet, "Payment B (Voided)").getCell(1).font?.color?.argb, "FF6B7280");
  assert.notEqual(rowForLabel(sheet, "Payment A").getCell(1).font?.color?.argb, "FF6B7280");
});
