/**
 * The bulk data-import template — the workbook a cooperative fills in when it
 * migrates its existing members, loans and share capital onto Lendyph.
 *
 * It began as the client's Lendy CSV Format workbook. What lives here is that
 * workbook as data, so the app can render it, let staff edit it, write CSVs
 * out of it, and build the blank workbook staff download (`./workbook`). Its
 * sheets follow the import's own columns: the members import's 26
 * (`CUSTOMER_COLUMNS`), the loans file's 18 (`LOAN_COLUMNS`) and the share
 * capital file's six (`SHARE_CAPITAL_COLUMNS`), which the client's workbook
 * lacked.
 *
 * Rows are keyed by column *id*, never by position: a column can be renamed,
 * reordered or removed and the data typed under it has to survive all three.
 */

export interface TemplateColumn {
  /** Stable identity. Survives renaming — the header is just a label. */
  id: string;
  header: string;
  required: boolean;
  /**
   * When the requirement is conditional, the condition in plain words, e.g.
   * "Required when Civil Status is Married". The workbook paints these blue
   * like any other required column and explains the condition in a footnote;
   * carrying it on the column is what lets validation not cry wolf.
   */
  requiredWhen?: string;
  /** Key into `DATA_DICTIONARY` when the column has a fixed set of values. */
  dictionary?: DictionaryKey;
  /** Shown under the header as a hint, e.g. a date format. */
  hint?: string;
}

/** One record. Missing keys and `""` both mean blank. */
export type TemplateRow = Record<string, string>;

export interface TemplateSheet {
  id: TemplateSheetId;
  name: string;
  description: string;
  columns: TemplateColumn[];
  rows: TemplateRow[];
}

export type TemplateSheetId = "members" | "loans" | "share_capital";

export type DictionaryKey =
  | "gender"
  | "civil_status"
  | "suffix"
  | "interest_type"
  | "payment_frequency"
  | "member_type"
  | "transaction_type";

export interface TemplateDraft {
  sheets: TemplateSheet[];
}

/** A guideline from the workbook's own Guidelines sheet. */
export interface TemplateGuideline {
  text: string;
  /** Lettered sub-points, as in the workbook's rule 4. */
  points?: string[];
}
