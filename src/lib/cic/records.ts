// Turns the records the API serves into the validation engine's input, and
// its issues back into per-record counts for the record lists.
import type { CicContractRecord, CicSettings, CicSubjectRecord } from "@/types/cic";
import type { CicIssue, CicRecordInput, CicValidationContext } from "./types";

/** The validation context for a File Reference Date under these settings. */
export function cicContext(settings: CicSettings, fileReferenceDate: string): CicValidationContext {
  return { mfi: settings.is_mfi, providerCode: settings.provider_code ?? "", fileReferenceDate };
}

export function subjectInput(record: CicSubjectRecord): CicRecordInput {
  return { type: record.record_type, values: record.values, label: `${record.subject_no} · ${record.name}` };
}

export function contractInput(record: CicContractRecord): CicRecordInput {
  const contract = record.loan_number ?? `Loan #${record.loan_id}`;
  return { type: record.record_type, values: record.values, label: `${contract} · ${record.borrower_name}` };
}

/**
 * Subjects first, then contracts: a contract names its subject by number, so
 * the file reads in that order. The index of each input is the issue's
 * `recordIndex`.
 */
export function buildRecordInputs(
  subjects: readonly CicSubjectRecord[],
  contracts: readonly CicContractRecord[],
): CicRecordInput[] {
  return [...subjects.map(subjectInput), ...contracts.map(contractInput)];
}

export interface CicRecordIssueCount {
  errors: number;
  warnings: number;
}

/** Errors and warnings per record index. File-level issues (no index) are left out. */
export function issueCountsByRecord(issues: readonly CicIssue[]): Map<number, CicRecordIssueCount> {
  const out = new Map<number, CicRecordIssueCount>();
  for (const issue of issues) {
    if (issue.recordIndex === undefined || issue.severity === "info") continue;
    const count = out.get(issue.recordIndex) ?? { errors: 0, warnings: 0 };
    if (issue.severity === "error") count.errors += 1;
    else count.warnings += 1;
    out.set(issue.recordIndex, count);
  }
  return out;
}

/**
 * The File Reference Date CIC expects by default: the last day of the month
 * before `todayIso` (YYYY-MM-DD, Manila). A monthly file reports the month
 * just closed.
 */
export function defaultCicReferenceDate(todayIso: string): string {
  const [y, m] = todayIso.split("-").map(Number);
  // Day 0 of this month is the last day of the previous one.
  const last = new Date(Date.UTC(y, m - 1, 0));
  const mm = String(last.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(last.getUTCDate()).padStart(2, "0");
  return `${last.getUTCFullYear()}-${mm}-${dd}`;
}
