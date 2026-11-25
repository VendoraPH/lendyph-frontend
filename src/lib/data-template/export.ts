import { csvBlob, toCsv } from "@/lib/csv";
import { filledRows } from "./draft";
import type { TemplateDraft, TemplateSheet } from "./types";

/**
 * Writing the template out.
 *
 * Two different things are downloadable on purpose. The workbook is the blank
 * form, built from the template's own sheets (`./workbook`), so it carries
 * every column the import reads, the Data Dictionary and Guidelines sheets and
 * the colour coding. The CSVs are what actually gets submitted, and those are
 * built from whatever is on screen.
 *
 * `exceljs`, `file-saver` and `jszip` are imported dynamically for the reason
 * the reports page documents: nobody should pay for them on a page they never
 * export from.
 */

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Guideline 3 asks for the header row to be removed before submitting. It is
 * kept here anyway: a headerless CSV is unreadable while the file is still
 * being worked on, and the person who submits it is the person who should
 * decide it is final.
 */
export function renderSheetCsv(sheet: TemplateSheet): string {
  const headers = sheet.columns.map((c) => c.header.trim());
  const rows = filledRows(sheet).map((row) =>
    sheet.columns.map((c) => row[c.id] ?? "")
  );
  return toCsv([headers, ...rows]);
}

export function sheetFilename(sheet: TemplateSheet): string {
  return `${sheet.name}.csv`;
}

/** The blank workbook: every sheet's header row, and nothing typed in. */
export async function downloadTemplateWorkbook(): Promise<void> {
  const [{ buildTemplateWorkbook, TEMPLATE_WORKBOOK_FILENAME }, { saveAs }] = await Promise.all([
    import("./workbook"),
    import("file-saver"),
  ]);
  const buffer = await buildTemplateWorkbook().xlsx.writeBuffer();
  saveAs(new Blob([buffer as BlobPart], { type: XLSX_TYPE }), TEMPLATE_WORKBOOK_FILENAME);
}

export async function downloadSheetCsv(sheet: TemplateSheet): Promise<void> {
  const { saveAs } = await import("file-saver");
  saveAs(csvBlob(renderSheetCsv(sheet)), sheetFilename(sheet));
}

/**
 * Every sheet in one archive. Two `saveAs` calls in a row would work in
 * exactly one browser and prompt a "download multiple files?" bar in the rest.
 */
export async function downloadDraftZip(draft: TemplateDraft): Promise<void> {
  const [{ default: JSZip }, { saveAs }] = await Promise.all([
    import("jszip"),
    import("file-saver"),
  ]);
  const zip = new JSZip();
  for (const sheet of draft.sheets) {
    zip.file(sheetFilename(sheet), csvBlob(renderSheetCsv(sheet)));
  }
  saveAs(await zip.generateAsync({ type: "blob" }), "lendy-import-csv.zip");
}
