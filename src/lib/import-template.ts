/**
 * The CSV import's templates: a header-only file per import file, built in the
 * browser from the importer's own column list (`columnsFor()`), so a template
 * can never disagree with what the pre-check and the server read.
 *
 * The header row is the workbook's labels in column order, which the pre-check
 * reads as a header (`detectHeaderRow`) with every label in its place. CRLF and
 * a UTF-8 BOM, as every CSV this app writes (`@/lib/csv`); the reader drops the
 * BOM again.
 *
 * Pure apart from `downloadImportTemplate`, so it runs under `tsx --test`.
 */
import { csvBlob, toCsv } from "@/lib/csv";
import { columnsFor, type ImportShape } from "@/lib/import-schema";

export interface ImportTemplate {
  shape: ImportShape;
  buttonLabel: string;
  fileName: string;
}

/** The templates the Prepare step offers, members first as the files are. */
export const IMPORT_TEMPLATES: readonly ImportTemplate[] = [
  { shape: "customer", buttonLabel: "Download members template", fileName: "members-import-template.csv" },
  { shape: "loans", buttonLabel: "Download loans template", fileName: "loans-import-template.csv" },
];

/**
 * The template's text: one header row, quoted per RFC 4180 where a label holds
 * a comma, quote or line break, ending in CRLF so the first data row starts on
 * its own line. Takes a shape, or the columns themselves.
 */
export function importTemplateCsv(source: ImportShape | readonly { label: string }[]): string {
  const columns = typeof source === "string" ? columnsFor(source) : source;
  return `${toCsv([columns.map((column) => column.label)])}\r\n`;
}

/** Save the template as a file. No server call. */
export async function downloadImportTemplate(template: ImportTemplate): Promise<void> {
  const { saveAs } = await import("file-saver");
  saveAs(csvBlob(importTemplateCsv(template.shape)), template.fileName);
}
