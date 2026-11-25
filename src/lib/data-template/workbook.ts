import ExcelJS from "exceljs";
import { DATA_DICTIONARY, TEMPLATE_GUIDELINES, TEMPLATE_SHEETS } from "./template";
import type { DictionaryKey, TemplateSheet } from "./types";

/**
 * The blank workbook behind "Download template": the page's sheets, written
 * from the same `TEMPLATE_SHEETS` the page shows, so the file has exactly the
 * columns the import reads (finish run round 4). It used to be the client's
 * original `.xlsm`, served as it was, which had the old 22 member columns and
 * no share capital sheet.
 *
 * One sheet per import file, its header in row 1 in the workbook's colours,
 * then the Data Dictionary and Guidelines sheets. Every cell takes text as
 * typed, so a spreadsheet doesn't drop an account number's leading zeros or
 * turn a date into one of its own.
 *
 * `exceljs` is heavy; `./export` loads this module only on the click.
 */

/** The workbook's own colours, read off its header row. */
export const REQUIRED_FILL_ARGB = "FF00B0F0";
export const OPTIONAL_FILL_ARGB = "FFFFFF00";

export const TEMPLATE_WORKBOOK_FILENAME = "Lendy CSV Format.xlsx";

/** Excel's own "Text" format. */
const TEXT_FORMAT = "@";

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

/** One import file's sheet: the header row, and nothing under it. */
function addDataSheet(workbook: ExcelJS.Workbook, sheet: TemplateSheet): void {
  const worksheet = workbook.addWorksheet(sheet.name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  worksheet.columns = sheet.columns.map((column) => ({
    key: column.id,
    width: Math.max(12, column.header.length + 4),
    style: { numFmt: TEXT_FORMAT },
  }));

  const header = worksheet.getRow(1);
  sheet.columns.forEach((column, index) => {
    const cell = header.getCell(index + 1);
    cell.value = column.header;
    cell.font = { bold: true };
    cell.fill = fill(column.required ? REQUIRED_FILL_ARGB : OPTIONAL_FILL_ARGB);
    // What the page shows under the header: when it is required, and how to write it.
    const note = [column.requiredWhen, column.hint].filter(Boolean).join("\n");
    if (note) cell.note = note;
  });
}

/** Which columns each list governs, as the page's Data Dictionary names them. */
function columnsUsing(key: DictionaryKey): string {
  return TEMPLATE_SHEETS.flatMap((sheet) =>
    sheet.columns.filter((column) => column.dictionary === key).map((column) => `${sheet.name} · ${column.header}`)
  ).join(", ");
}

/** Each list, its values one per row, and the columns that use it. */
function addDictionarySheet(workbook: ExcelJS.Workbook): void {
  const worksheet = workbook.addWorksheet("Data Dictionary");
  worksheet.columns = [{ width: 20 }, { width: 22 }, { width: 48 }];
  const heading = worksheet.addRow(["List", "Values", "Used in"]);
  heading.font = { bold: true };

  for (const [key, entry] of Object.entries(DATA_DICTIONARY) as [DictionaryKey, (typeof DATA_DICTIONARY)[DictionaryKey]][]) {
    entry.values.forEach((value, index) => {
      worksheet.addRow(index === 0 ? [entry.label, value, columnsUsing(key)] : [null, value, null]);
    });
  }
}

/** The numbered guidelines, their points lettered beneath them. */
function addGuidelinesSheet(workbook: ExcelJS.Workbook): void {
  const worksheet = workbook.addWorksheet("Guidelines");
  worksheet.columns = [{ width: 4 }, { width: 4 }, { width: 110 }];

  TEMPLATE_GUIDELINES.forEach((guideline, index) => {
    const row = worksheet.addRow([String(index + 1), guideline.text]);
    worksheet.mergeCells(row.number, 2, row.number, 3);
    for (const [letter, point] of (guideline.points ?? []).entries()) {
      worksheet.addRow([null, `${String.fromCharCode(97 + letter)}.`, point]);
    }
  });
}

/** The blank workbook, built without saving it, so tests read the real file back. */
export function buildTemplateWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  for (const sheet of TEMPLATE_SHEETS) addDataSheet(workbook, sheet);
  addDictionarySheet(workbook);
  addGuidelinesSheet(workbook);
  return workbook;
}
