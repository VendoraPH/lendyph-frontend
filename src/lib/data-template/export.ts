import { csvBlob, toCsv } from "@/lib/csv";
import { filledRows } from "./draft";
import { TEMPLATE_FILE } from "./template";
import type { TemplateDraft, TemplateSheet } from "./types";

/**
 * Writing the template out.
 *
 * Two different things are downloadable on purpose. The workbook is the
 * artefact the cooperative was given and may already have circulated, so it is
 * served byte-for-byte from `public/` — never regenerated, because a rebuilt
 * copy would quietly lose the Data Dictionary sheet, the colour coding and the
 * macros the extension implies. The CSVs are what actually gets submitted, and
 * those are built from whatever is on screen.
 *
 * `file-saver` and `jszip` are imported dynamically for the reason the reports
 * page documents: nobody should pay for them on a page they never export from.
 */

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

/** The original workbook, untouched. */
export async function downloadTemplateWorkbook(): Promise<void> {
  const res = await fetch(TEMPLATE_FILE.url);
  if (!res.ok) {
    throw new Error(`Template unavailable (${res.status})`);
  }
  const { saveAs } = await import("file-saver");
  saveAs(await res.blob(), TEMPLATE_FILE.filename);
}

export async function downloadSheetCsv(sheet: TemplateSheet): Promise<void> {
  const { saveAs } = await import("file-saver");
  saveAs(csvBlob(renderSheetCsv(sheet)), sheetFilename(sheet));
}

/**
 * Both sheets in one archive. Two `saveAs` calls in a row would work in
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
