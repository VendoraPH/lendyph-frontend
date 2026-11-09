// The year-end close on the Period Closing screen: what the preview, the
// history and the reopen show, read from the server's answers as they come.
// Nothing here adds, subtracts or derives money (see no-browser-money.test.ts).
// Dependency-free apart from formatters, so it runs under `tsx --test`.

import { formatCentavos } from "@/lib/accounting/money";
import { signedCentavos } from "../../_lib/signed-money";
import { getErrorMessage, getFieldErrors, httpStatusOf } from "@/lib/api-error";
import { formatDate, formatDateTime } from "@/lib/format";
import type {
  AccountingBranchRef,
  AccountingPeriod,
  YearClose,
  YearClosePage,
  YearClosePreview,
  YearClosePreviewBranch,
  YearClosePreviewLine,
} from "@/types";
import { yearCloseStatusLabel } from "../../_lib/display-labels";

/** The history's page size, as the brief sets it (the server allows up to 100). */
export const YEAR_CLOSE_PER_PAGE = 25;

/** The API's `max:500` on a reopen's reason. */
export const REOPEN_REASON_MAX = 500;

/** A 403 on the preview: the close needs every branch in view (`branches:view_all`). */
export const YEAR_CLOSE_FORBIDDEN =
  "The year-end close posts an entry for every branch, so it needs access to all branches. Ask an administrator if you should have it.";

const NO_BRANCH = "Journals with no branch";

const FOUR_DIGIT_YEAR = /^\d{4}$/;

/**
 * ₱ with two decimals, a loss in parentheses; ₱0.00 for a zero, and "—" only
 * when the figure is missing.
 */
export function centavosOrDash(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? signedCentavos(value) : "—";
}

export interface NetResult {
  label: "Net surplus" | "Net loss";
  /** The server's figure without its sign: the label says which way it went. */
  amount: string;
  loss: boolean;
}

/** A signed result as a label and the server's amount: a negative one reads "Net loss". */
export function netResult(net: number | null | undefined): NetResult {
  const loss = typeof net === "number" && net < 0;
  return {
    label: loss ? "Net loss" : "Net surplus",
    amount: typeof net === "number" && Number.isFinite(net) ? formatCentavos(net).replace(/^-/, "") : "—",
    loss,
  };
}

function branchName(branch: AccountingBranchRef | null): string {
  return branch?.name ?? NO_BRANCH;
}

// ── Preview ──

export interface PreviewLineView {
  key: number;
  account: string;
  amount: string;
}

export interface PreviewBranchView {
  key: string;
  name: string;
  income: PreviewLineView[];
  expenses: PreviewLineView[];
  totalIncome: string;
  totalExpenses: string;
  result: NetResult;
}

export interface PreviewView {
  year: number;
  asOf: string;
  movesTo: string;
  branches: PreviewBranchView[];
  totalIncome: string;
  totalExpenses: string;
  result: NetResult;
  monthsToClose: string[];
  blockingReasons: string[];
  canClose: boolean;
}

function lineView(line: YearClosePreviewLine): PreviewLineView {
  return {
    key: line.account_id,
    account: `${line.account_code} ${line.account_name}`,
    amount: centavosOrDash(line.amount),
  };
}

function branchView(branch: YearClosePreviewBranch): PreviewBranchView {
  return {
    key: branch.branch ? `branch-${branch.branch.id}` : "no-branch",
    name: branchName(branch.branch),
    income: branch.lines.filter((l) => l.type === "income").map(lineView),
    expenses: branch.lines.filter((l) => l.type === "expense").map(lineView),
    totalIncome: centavosOrDash(branch.total_income),
    totalExpenses: centavosOrDash(branch.total_expenses),
    result: netResult(branch.net_surplus),
  };
}

export function previewView(preview: YearClosePreview): PreviewView {
  const account = preview.net_surplus_account;
  return {
    year: preview.year,
    asOf: formatDate(preview.as_of),
    movesTo: `Moves to ${account.code} ${account.name}`,
    branches: preview.branches.map(branchView),
    totalIncome: centavosOrDash(preview.total_income),
    totalExpenses: centavosOrDash(preview.total_expenses),
    result: netResult(preview.net_surplus),
    monthsToClose: preview.periods_to_close.map((p) => p.name),
    blockingReasons: preview.blocking_reasons,
    // The server decides; the reasons are shown, never re-judged here.
    canClose: preview.can_close === true,
  };
}

export function closeConfirmText(preview: YearClosePreview): string {
  const account = preview.net_surplus_account;
  return `This posts a closing entry for each branch dated ${formatDate(preview.as_of)}, moving the year's income and expenses to ${account.code} ${account.name}, then closes every month of ${preview.year}. Reopen only to correct the year.`;
}

/** Why a close was refused, in the server's words: each blocking reason on `year` (422), or its message (409). */
export function closeRefusalReasons(err: unknown, year: number): string[] {
  const reasons = getFieldErrors(err);
  if (httpStatusOf(err) === 422 && reasons.length > 0) return reasons;
  return [getErrorMessage(err, `Could not close ${year}.`)];
}

export type PreviewLoad = { kind: "preview"; preview: YearClosePreview } | { kind: "forbidden" };

/**
 * The preview, or "forbidden" on a 403 so the screen can explain it in words
 * (a branch user can't close the books for every branch). Anything else is
 * thrown on to the screen's error state.
 */
export async function loadPreview(
  year: number,
  fetchPreview: (year: number) => Promise<YearClosePreview>,
): Promise<PreviewLoad> {
  try {
    return { kind: "preview", preview: await fetchPreview(year) };
  } catch (err) {
    if (httpStatusOf(err) === 403) return { kind: "forbidden" };
    throw err;
  }
}

// ── Year picker ──

export interface YearItem {
  value: string;
  label: string;
}

/**
 * The years the books span (from the periods list), oldest first, less those
 * with a live close. A year that hasn't ended stays: its preview says why it
 * can't be closed yet.
 */
export function closeYearItems(periods: AccountingPeriod[], closes: YearClose[]): YearItem[] {
  const closed = new Set(closes.filter((c) => c.status === "closed").map((c) => String(c.year)));
  const years = [...new Set(periods.map((p) => p.start_date.slice(0, 4)))]
    .filter((year) => FOUR_DIGIT_YEAR.test(year) && !closed.has(year))
    .sort();
  return years.map((year) => ({ value: year, label: year }));
}

/** The oldest year not closed: the previous year has to be closed first. */
export function defaultCloseYear(items: YearItem[]): string | null {
  return items[0]?.value ?? null;
}

// ── Months ──

/** Period id → "Closed by the YYYY year-end close", for live closes only. */
export function periodYearEndLabels(closes: YearClose[]): Map<number, string> {
  const labels = new Map<number, string>();
  for (const close of closes) {
    if (close.status !== "closed") continue;
    for (const period of close.periods_closed) {
      labels.set(period.id, `Closed by the ${close.year} year-end close`);
    }
  }
  return labels;
}

// ── History ──

export function historyQuery(page: number): { page: number; per_page: number } {
  return { page, per_page: YEAR_CLOSE_PER_PAGE };
}

export function historyPaging(page: YearClosePage): { page: number; perPage: number; total: number } {
  return { page: page.meta.current_page, perPage: page.meta.per_page, total: page.meta.total };
}

/** The server's total over every matching row, not this page. */
export function historyTotal(page: YearClosePage): string {
  return centavosOrDash(page.meta.totals?.net_surplus);
}

export interface HistoryEntryView {
  key: string;
  branch: string;
  journalNo: string;
  href: string;
  netSurplus: string;
}

export interface HistoryRowView {
  id: number;
  year: number;
  status: string;
  loss: boolean;
  netSurplus: string;
  entries: HistoryEntryView[];
  closedBy: string;
  closedAt: string;
  reopenedBy: string;
  reopenedAt: string | null;
  reopenReason: string | null;
}

export function historyRowView(row: YearClose): HistoryRowView {
  return {
    id: row.id,
    year: row.year,
    status: yearCloseStatusLabel(row.status),
    loss: row.net_surplus < 0,
    netSurplus: centavosOrDash(row.net_surplus),
    entries: row.entries.map((entry) => ({
      key: `journal-${entry.journal.id}`,
      branch: branchName(entry.branch),
      journalNo: entry.journal.journal_no,
      href: `/accounting/journals/${entry.journal.id}`,
      netSurplus: centavosOrDash(entry.net_surplus),
    })),
    closedBy: row.closed_by?.name ?? "—",
    closedAt: row.closed_at ? formatDateTime(row.closed_at) : "—",
    reopenedBy: row.reopened_by?.name ?? "—",
    reopenedAt: row.reopened_at ? formatDateTime(row.reopened_at) : null,
    reopenReason: row.reopen_reason,
  };
}

/** The latest year with a live close: the only one the server lets reopen. */
export function latestClosedId(rows: YearClose[]): number | null {
  let latest: YearClose | null = null;
  for (const row of rows) {
    if (row.status === "closed" && (latest === null || row.year > latest.year)) latest = row;
  }
  return latest?.id ?? null;
}

// ── Reopen ──

/** Why the reason can't be sent as typed; null when it can. */
export function reopenReasonError(reason: string): string | null {
  const typed = reason.trim();
  if (typed === "") return "Enter the reason for reopening this year.";
  if (typed.length > REOPEN_REASON_MAX) return `The reason can be at most ${REOPEN_REASON_MAX} characters.`;
  return null;
}

export function reopenReason(reason: string): string {
  return reason.trim();
}

export function reopenConfirmText(row: YearClose): string {
  const journals = row.entries.map((e) => e.journal.journal_no).join(", ");
  const months = row.periods_closed.map((p) => p.name).join(", ");
  return `This reverses the ${row.year} closing entries${journals ? ` (${journals})` : ""} and reopens the months the close closed${months ? `: ${months}` : ""}.`;
}
