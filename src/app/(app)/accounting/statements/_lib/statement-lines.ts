import type {
  BalanceSheetLine,
  BalanceSheetLineKind,
  EquityChangeRow,
  IncomeStatementLine,
  ReportLine,
} from "@/types";
import type { ReportSectionLine } from "../../_components/report-section";

/**
 * The two balance sheet lines the server derives, with no account of their
 * own. Named here rather than taken from `account_name` so they always read
 * the same on screen, and so the line nobody can post to never looks like one.
 */
const DERIVED_LABELS: Partial<Record<BalanceSheetLineKind, string>> = {
  current_year_earnings: "Current Year Earnings",
  prior_period_earnings: "Prior Period Earnings (not yet closed)",
};

/**
 * What a balance sheet line reads: the derived line's label, or else the
 * line's own name (an account line, or a kind this screen doesn't know yet).
 */
export function balanceSheetLineLabel(line: BalanceSheetLine): string {
  return DERIVED_LABELS[line.kind] ?? line.account_name;
}

const accountKey = (id: number | null | undefined, kind: string) =>
  id == null ? kind : `account-${id}`;

/** Balance sheet lines for a `ReportSection`, amounts exactly as the server sent them. */
export function balanceSheetLines(lines: BalanceSheetLine[]): ReportSectionLine[] {
  return lines.map((line) => ({
    key: accountKey(line.account_id, line.kind),
    code: line.account_code ?? undefined,
    label: balanceSheetLineLabel(line),
    amount: line.amount,
  }));
}

/** Income statement lines for a `ReportSection`, as the server sent them. */
export function incomeStatementLines(lines: IncomeStatementLine[]): ReportSectionLine[] {
  return lines.map((line) => ({
    key: accountKey(line.account_id, "account"),
    code: line.account_code,
    label: line.account_name,
    amount: line.amount,
  }));
}

/**
 * Cash flow lines for a `ReportSection`. Each reads the server's `label`; the
 * derived operating lines carry no account, so no code either. Keys are
 * prefixed by the section so an account in two blocks never collides.
 */
export function cashFlowLines(lines: ReportLine[], section: string): ReportSectionLine[] {
  return lines.map((line, i) => ({
    key:
      line.kind === "account" && line.account_id != null
        ? `${section}-account-${line.account_id}`
        : `${section}-${line.kind}-${i}`,
    code: line.account_code ?? undefined,
    label: line.label,
    amount: line.amount,
  }));
}

/** A stable key for an equity changes row; the earnings row has no account. */
export function equityRowKey(row: EquityChangeRow): string {
  return accountKey(row.account_id, row.kind);
}
