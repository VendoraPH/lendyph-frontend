import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { CUSTOMER_COLUMNS, LOAN_COLUMNS, SHARE_CAPITAL_COLUMNS, detectHeaderRow, type ImportShape } from "@/lib/import-schema";
import { DATA_DICTIONARY, TEMPLATE_GUIDELINES, TEMPLATE_SHEETS } from "./template";
import {
  OPTIONAL_FILL_ARGB,
  REQUIRED_FILL_ARGB,
  TEMPLATE_WORKBOOK_FILENAME,
  buildTemplateWorkbook,
} from "./workbook";

/**
 * The blank workbook "Download template" gives, written out and read back as
 * a real .xlsx, so what is checked is the file a cooperative opens, not the
 * model that made it.
 */
async function readBack(): Promise<ExcelJS.Workbook> {
  const buffer = await buildTemplateWorkbook().xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(buffer as ArrayBuffer);
  return reopened;
}

function worksheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const found = workbook.getWorksheet(name);
  assert.ok(found, `no "${name}" sheet`);
  return found;
}

/** Row 1's cells as text, up to the last filled one. */
function headerRow(sheet: ExcelJS.Worksheet): string[] {
  const row = sheet.getRow(1);
  return Array.from({ length: row.cellCount }, (_, index) => row.getCell(index + 1).text);
}

/** Every cell's text in the sheet, for the reference sheets. */
function sheetText(sheet: ExcelJS.Worksheet): string[] {
  const cells: string[] = [];
  sheet.eachRow((row) => row.eachCell((cell) => cells.push(cell.text)));
  return cells;
}

test("the workbook has the page's sheets, in its order: Members, Loans, Share Capital, then the two reference sheets", async () => {
  const workbook = await readBack();
  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    ["Members", "Loans", "Share Capital", "Data Dictionary", "Guidelines"]
  );
  assert.deepEqual(TEMPLATE_SHEETS.map((sheet) => sheet.name), ["Members", "Loans", "Share Capital"]);
  assert.match(TEMPLATE_WORKBOOK_FILENAME, /\.xlsx$/);
});

test("each data sheet's header row is its import file's columns, in order: 26 for Members, 18 for Loans, 6 for Share Capital", async () => {
  const workbook = await readBack();
  const expected: Array<[string, readonly { label: string }[], number]> = [
    ["Members", CUSTOMER_COLUMNS, 26],
    ["Loans", LOAN_COLUMNS, 18],
    ["Share Capital", SHARE_CAPITAL_COLUMNS, 6],
  ];
  for (const [name, columns, width] of expected) {
    const sheet = worksheet(workbook, name);
    assert.equal(columns.length, width, name);
    assert.deepEqual(headerRow(sheet), columns.map((column) => column.label), name);
    // A blank form: nothing below the header.
    assert.equal(sheet.actualRowCount, 1, name);
  }
  // The four Member Profile columns the old workbook lacked.
  assert.deepEqual(headerRow(worksheet(workbook, "Members")).slice(22), [
    "Date Hired", "Membership Date", "Member Type", "Membership Number",
  ]);
});

test("a header row saved as a CSV reads as the header of the right file", async () => {
  const workbook = await readBack();
  const shapes: Array<[string, ImportShape]> = [["Members", "customer"], ["Loans", "loans"], ["Share Capital", "share_capital"]];
  for (const [name, shape] of shapes) {
    const detection = detectHeaderRow(headerRow(worksheet(workbook, name)), shape);
    assert.equal(detection.isHeader, true, name);
    assert.equal(detection.positionalScore, 1, name);
  }
});

test("headers keep the workbook's colours: blue required, yellow optional, the spouse block blue", async () => {
  const workbook = await readBack();
  for (const templateSheet of TEMPLATE_SHEETS) {
    const row = worksheet(workbook, templateSheet.name).getRow(1);
    templateSheet.columns.forEach((column, index) => {
      const fill = row.getCell(index + 1).fill;
      assert.equal(fill?.type, "pattern", column.header);
      const argb = fill?.type === "pattern" ? fill.fgColor?.argb : undefined;
      assert.equal(argb, column.required ? REQUIRED_FILL_ARGB : OPTIONAL_FILL_ARGB, `${templateSheet.name} · ${column.header}`);
    });
  }
  const members = worksheet(workbook, "Members").getRow(1);
  const spouse = CUSTOMER_COLUMNS.findIndex((column) => column.key === "spouse_first_name");
  const middle = CUSTOMER_COLUMNS.findIndex((column) => column.key === "middle_name");
  const fillOf = (cell: ExcelJS.Cell) => (cell.fill?.type === "pattern" ? cell.fill.fgColor?.argb : undefined);
  assert.equal(fillOf(members.getCell(spouse + 1)), REQUIRED_FILL_ARGB);
  assert.equal(fillOf(members.getCell(middle + 1)), OPTIONAL_FILL_ARGB);
});

test("a header says when it is required and how to write it, as the page does", async () => {
  const workbook = await readBack();
  const members = worksheet(workbook, "Members").getRow(1);
  const noteOf = (row: ExcelJS.Row, index: number) => {
    const note = row.getCell(index + 1).note;
    return typeof note === "string" ? note : (note?.texts ?? []).map((part) => part.text).join("");
  };
  const at = (key: string) => CUSTOMER_COLUMNS.findIndex((column) => column.key === key);
  assert.equal(noteOf(members, at("spouse_first_name")), "Required when Civil Status is Married");
  assert.equal(noteOf(members, at("birthdate")), "YYYY-MM-DD");
  assert.equal(noteOf(members, at("member_type")), "Blank means Regular");
  assert.equal(noteOf(members, at("last_name")), "");

  const shareCapital = worksheet(workbook, "Share Capital").getRow(1);
  assert.equal(noteOf(shareCapital, 4), "Above ₱0.00, 2 decimals at most");
});

test("every cell takes text as typed, so account numbers keep their zeros and dates stay as written", async () => {
  const workbook = await readBack();
  for (const templateSheet of TEMPLATE_SHEETS) {
    const sheet = worksheet(workbook, templateSheet.name);
    templateSheet.columns.forEach((column, index) => {
      assert.equal(sheet.getColumn(index + 1).numFmt, "@", `${templateSheet.name} · ${column.header}`);
    });
  }
});

test("the Data Dictionary sheet lists every list and its values, and the columns that use it", async () => {
  const text = sheetText(worksheet(await readBack(), "Data Dictionary"));
  for (const entry of Object.values(DATA_DICTIONARY)) {
    assert.ok(text.includes(entry.label), entry.label);
    for (const value of entry.values) assert.ok(text.includes(value), `${entry.label}: ${value}`);
  }
  assert.ok(text.includes("Members · Gender"));
  assert.ok(text.includes("Loans · Payment Frequency"));
  assert.ok(text.includes("Share Capital · Transaction Type"));
});

test("the Guidelines sheet carries every guideline and point, numbered and lettered", async () => {
  const text = sheetText(worksheet(await readBack(), "Guidelines"));
  for (const [index, guideline] of TEMPLATE_GUIDELINES.entries()) {
    assert.ok(text.includes(String(index + 1)), `number ${index + 1}`);
    assert.ok(text.includes(guideline.text), guideline.text);
    for (const [letter, point] of (guideline.points ?? []).entries()) {
      assert.ok(text.includes(`${String.fromCharCode(97 + letter)}.`), point);
      assert.ok(text.includes(point), point);
    }
  }
  assert.ok(text.some((cell) => /Blue fields indicate required data/.test(cell)));
});
