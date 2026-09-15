import { TEMPLATE_SHEETS } from "./template";
import type { TemplateColumn, TemplateDraft, TemplateRow, TemplateSheet } from "./types";

/**
 * Every edit staff can make to the template, as pure `sheet -> sheet`
 * functions.
 *
 * Kept out of the React tree so the rules that actually matter — a removed
 * column takes its data with it, a renamed one does not — are unit-testable
 * without rendering a 22-column grid.
 */

export function blankRow(columns: TemplateColumn[]): TemplateRow {
  return Object.fromEntries(columns.map((c) => [c.id, ""]));
}

/** A fresh copy of the workbook with one empty row per sheet to type into. */
export function createDraft(): TemplateDraft {
  return {
    sheets: TEMPLATE_SHEETS.map((sheet) => ({
      ...sheet,
      columns: sheet.columns.map((c) => ({ ...c })),
      rows: [blankRow(sheet.columns)],
    })),
  };
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export function addRow(sheet: TemplateSheet): TemplateSheet {
  return { ...sheet, rows: [...sheet.rows, blankRow(sheet.columns)] };
}

export function removeRow(sheet: TemplateSheet, index: number): TemplateSheet {
  return { ...sheet, rows: sheet.rows.filter((_, i) => i !== index) };
}

export function updateCell(
  sheet: TemplateSheet,
  index: number,
  columnId: string,
  value: string
): TemplateSheet {
  return {
    ...sheet,
    rows: sheet.rows.map((row, i) =>
      i === index ? { ...row, [columnId]: value } : row
    ),
  };
}

/** Drops every row, keeping the columns as edited. */
export function clearRows(sheet: TemplateSheet): TemplateSheet {
  return { ...sheet, rows: [blankRow(sheet.columns)] };
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

/**
 * `column_1`, `column_2`, … skipping anything taken. Ids are never reused
 * within a session, but a removed id becoming free again is harmless: its data
 * went with it.
 */
function nextColumnId(columns: TemplateColumn[]): string {
  const taken = new Set(columns.map((c) => c.id));
  let n = columns.length + 1;
  while (taken.has(`column_${n}`)) n += 1;
  return `column_${n}`;
}

/** Appends after `afterId`, or at the end when it is not given. */
export function addColumn(
  sheet: TemplateSheet,
  afterId?: string
): TemplateSheet {
  const column: TemplateColumn = {
    id: nextColumnId(sheet.columns),
    header: "New column",
    required: false,
  };
  const at = afterId
    ? sheet.columns.findIndex((c) => c.id === afterId) + 1
    : sheet.columns.length;
  const columns = [...sheet.columns];
  columns.splice(at <= 0 ? sheet.columns.length : at, 0, column);
  return {
    ...sheet,
    columns,
    rows: sheet.rows.map((row) => ({ ...row, [column.id]: "" })),
  };
}

/** Removing a column removes the data typed under it — that is the point. */
export function removeColumn(
  sheet: TemplateSheet,
  columnId: string
): TemplateSheet {
  return {
    ...sheet,
    columns: sheet.columns.filter((c) => c.id !== columnId),
    rows: sheet.rows.map((row) => {
      const next = { ...row };
      delete next[columnId];
      return next;
    }),
  };
}

export function renameColumn(
  sheet: TemplateSheet,
  columnId: string,
  header: string
): TemplateSheet {
  return {
    ...sheet,
    columns: sheet.columns.map((c) => (c.id === columnId ? { ...c, header } : c)),
  };
}

export function setColumnRequired(
  sheet: TemplateSheet,
  columnId: string,
  required: boolean
): TemplateSheet {
  return {
    ...sheet,
    columns: sheet.columns.map((c) =>
      c.id === columnId ? { ...c, required } : c
    ),
  };
}

/** No-op at either end, so the caller never has to bounds-check. */
export function moveColumn(
  sheet: TemplateSheet,
  columnId: string,
  direction: "left" | "right"
): TemplateSheet {
  const from = sheet.columns.findIndex((c) => c.id === columnId);
  if (from === -1) return sheet;
  const to = direction === "left" ? from - 1 : from + 1;
  if (to < 0 || to >= sheet.columns.length) return sheet;
  const columns = [...sheet.columns];
  const [moved] = columns.splice(from, 1);
  columns.splice(to, 0, moved);
  return { ...sheet, columns };
}

// ---------------------------------------------------------------------------
// Draft-level helpers
// ---------------------------------------------------------------------------

export function mapSheet(
  draft: TemplateDraft,
  sheetId: string,
  fn: (sheet: TemplateSheet) => TemplateSheet
): TemplateDraft {
  return {
    sheets: draft.sheets.map((s) => (s.id === sheetId ? fn(s) : s)),
  };
}

export function findSheet(
  draft: TemplateDraft,
  sheetId: string
): TemplateSheet | undefined {
  return draft.sheets.find((s) => s.id === sheetId);
}

/** A row nobody typed into. Blank trailing rows are not data. */
export function isRowEmpty(row: TemplateRow): boolean {
  return Object.values(row).every((v) => v.trim() === "");
}

export function filledRows(sheet: TemplateSheet): TemplateRow[] {
  return sheet.rows.filter((row) => !isRowEmpty(row));
}
