import { filledRows, isRowEmpty } from "./draft";
import type { TemplateDraft, TemplateSheet } from "./types";

/**
 * The workbook's own rules, checked while staff type rather than after the
 * file has been handed over.
 *
 * Deliberately advisory: nothing here blocks an export. A cooperative
 * mid-migration has half-filled sheets on purpose, and a template that refuses
 * to download until it is perfect is a template staff will fill in Excel
 * instead.
 */

export interface TemplateIssue {
  sheetId: string;
  /** 0-based index into the sheet's rows, or `null` for a column-level issue. */
  row: number | null;
  columnId?: string;
  message: string;
}

/** Guideline 6: the spouse block is required only for a married member. */
const CONDITION_COLUMN = "civil_status";
const CONDITION_VALUE = "married";

function validateColumns(sheet: TemplateSheet): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const seen = new Map<string, string>();

  for (const column of sheet.columns) {
    const header = column.header.trim();
    if (!header) {
      issues.push({
        sheetId: sheet.id,
        row: null,
        columnId: column.id,
        message: "A column has no header. Name it or remove it.",
      });
      continue;
    }
    const key = header.toLowerCase();
    if (seen.has(key)) {
      issues.push({
        sheetId: sheet.id,
        row: null,
        columnId: column.id,
        message: `Two columns are both called "${header}".`,
      });
    } else {
      seen.set(key, column.id);
    }
  }

  return issues;
}

function validateRows(sheet: TemplateSheet): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const hasConditionColumn = sheet.columns.some((c) => c.id === CONDITION_COLUMN);

  sheet.rows.forEach((row, index) => {
    // A blank row is a row nobody has started, not a row missing 14 values.
    if (isRowEmpty(row)) return;

    const married =
      (row[CONDITION_COLUMN] ?? "").trim().toLowerCase() === CONDITION_VALUE;

    for (const column of sheet.columns) {
      if (!column.required) continue;
      if ((row[column.id] ?? "").trim() !== "") continue;
      // Conditional columns only bite when the condition holds — and not at
      // all if staff removed the column the condition reads.
      if (column.requiredWhen && (!hasConditionColumn || !married)) continue;
      issues.push({
        sheetId: sheet.id,
        row: index,
        columnId: column.id,
        message: `${column.header || "This column"} is required.`,
      });
    }
  });

  return issues;
}

/** Guidelines 4b–4c: unique member accounts, every loan tied to one. */
function validateAccountNumbers(draft: TemplateDraft): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const profiles = draft.sheets.find((s) => s.id === "customer_profile");
  const loans = draft.sheets.find((s) => s.id === "loans");
  if (!profiles) return issues;

  const seen = new Set<string>();
  profiles.rows.forEach((row, index) => {
    const account = (row.account_no ?? "").trim();
    if (!account) return;
    if (seen.has(account)) {
      issues.push({
        sheetId: profiles.id,
        row: index,
        columnId: "account_no",
        message: `Account No. ${account} appears more than once. Member accounts must be unique.`,
      });
    }
    seen.add(account);
  });

  // Only meaningful once there is a member list to check against — a Loans
  // sheet filled on its own is a legitimate half of the submission.
  if (!loans || filledRows(profiles).length === 0) return issues;

  loans.rows.forEach((row, index) => {
    const account = (row.account_no ?? "").trim();
    if (!account || seen.has(account)) return;
    issues.push({
      sheetId: loans.id,
      row: index,
      columnId: "account_no",
      message: `Account No. ${account} has no matching row on Customer Profile.`,
    });
  });

  return issues;
}

export function validateDraft(draft: TemplateDraft): TemplateIssue[] {
  return [
    ...draft.sheets.flatMap(validateColumns),
    ...draft.sheets.flatMap(validateRows),
    ...validateAccountNumbers(draft),
  ];
}

export function issuesForSheet(
  issues: TemplateIssue[],
  sheetId: string
): TemplateIssue[] {
  return issues.filter((i) => i.sheetId === sheetId);
}
