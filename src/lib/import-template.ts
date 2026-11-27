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

/** The templates the Prepare step offers, in the order of the files. */
export const IMPORT_TEMPLATES: readonly ImportTemplate[] = [
  { shape: "customer", buttonLabel: "Download members template", fileName: "members-import-template.csv" },
  { shape: "loans", buttonLabel: "Download loans template", fileName: "loans-import-template.csv" },
  { shape: "share_capital", buttonLabel: "Download share capital template", fileName: "share-capital-import-template.csv" },
];

/** The templates this person may use: share capital's only when they can record share capital. */
export function importTemplates(shareCapitalAllowed: boolean): readonly ImportTemplate[] {
  return shareCapitalAllowed ? IMPORT_TEMPLATES : IMPORT_TEMPLATES.filter((template) => template.shape !== "share_capital");
}

/**
 * What the members template can't carry, and what still imports, said on the
 * Prepare step. Valid IDs and the photo are files (`documents`, `photo_path`),
 * so they have no column.
 */
export const MEMBERS_TEMPLATE_NOTE =
  "Valid IDs and member photos are files, so the import can't carry them: add them on each member's profile after the import. A members file made before Date Hired and the membership columns were added still imports: its members get no date hired, membership date or membership number, and Member Type reads Regular, the default.";

/**
 * What the share capital file takes and what becomes of it, said on the
 * Prepare step: the server's own rules (`ShareCapitalRowNormalizer` and
 * `ShareCapitalRowImporter`), in words.
 */
export const SHARE_CAPITAL_TEMPLATE_NOTE =
  "In the share capital file, each row names its member by account number or member ID, from the members file of the same import or already in Lendyph. Transaction Type is Contribution or Withdrawal, Transaction Date is written year-month-day, such as 2026-11-24, and Amount is above ₱0.00 with at most two decimals. A row with the same reference as an entry already on the ledger, or with no reference the same member, date, type and amount, is skipped, and a withdrawal can't take a balance below ₱0.00. Imported entries show on each member's Share Capital ledger, in the member's own branch, marked imported, and post nothing to the books.";

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
