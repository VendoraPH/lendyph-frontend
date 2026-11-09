import type {
  Account,
  Permission,
  ReconcileLineAsExpenseBody,
  ReconcileLineAsTransferBody,
  ReconcileLineToSuspenseBody,
} from "@/types";
import type { LineActionKind, MatchReconciliationBody, ReconciliationRow } from "./types";

/**
 * What an unmatched statement line can be recorded as, and who may do it.
 *
 * Each action needs `accounting:reconcile` and access to all branches (the
 * page's own gate) plus its own record's permission. A missing permission
 * disables the action with the reason; an expense on money in is not offered
 * at all, since the server refuses it.
 */

/** C5's caps: the expense payee column is 160 characters, the suspense note 255. */
export const EXPENSE_PAYEE_MAX = 160;
export const EXPENSE_DESCRIPTION_MAX = 500;
export const TRANSFER_DESCRIPTION_MAX = 500;
export const SUSPENSE_DESCRIPTION_MAX = 255;

export interface LineAction {
  kind: LineActionKind;
  label: string;
  visible: boolean;
  /** Why the action isn't offered on this line (shown as a hint). */
  hiddenReason: string | null;
  /** Why the action is offered but can't be used by this user. */
  disabledReason: string | null;
}

interface ActionContext {
  can: (permission: Permission) => boolean;
  /** False when the chart is the built-in template, whose ids aren't real accounts. */
  chartAvailable: boolean;
}

export const MONEY_IN_EXPENSE_REASON =
  "Only money out can be recorded as an expense. Record money in as a transfer, or move it to suspense.";
const NO_CHART_REASON = "The chart of accounts isn't available, so no account can be picked.";

/** A statement line nothing in the books stands for yet. */
export function isResolvable(row: ReconciliationRow): boolean {
  return row.source === "statement" && row.match === "unmatched" && row.statement_line_id !== null;
}

export function lineActions(row: ReconciliationRow, { can, chartAvailable }: ActionContext): LineAction[] {
  if (!isResolvable(row)) return [];

  const moneyOut = row.amount < 0;
  const needsChart = chartAvailable ? null : NO_CHART_REASON;

  return [
    {
      kind: "expense",
      label: "Record as expense",
      visible: moneyOut,
      hiddenReason: moneyOut ? null : MONEY_IN_EXPENSE_REASON,
      disabledReason: can("expenses:create") ? needsChart : "Your role can't record expenses.",
    },
    {
      kind: "transfer",
      label: "Record as transfer",
      visible: true,
      hiddenReason: null,
      disabledReason: can("cash_accounts:transfer")
        ? needsChart
        : "Your role can't record transfers between money accounts.",
    },
    {
      kind: "suspense",
      label: "Move to suspense",
      visible: true,
      hiddenReason: null,
      disabledReason:
        can("journals:create") && can("journals:post")
          ? null
          : "Your role can't create and post journal entries.",
    },
  ];
}

/** The pairing a row offers: confirm a suggestion, undo a match, or match by hand. */
export function rowMatchAction(row: ReconciliationRow): "confirm" | "unmatch" | "match" | null {
  if (row.statement_line_id === null) return null;
  if (row.match === "possible" && row.journal_line_id !== null) return "confirm";
  if (row.match === "matched") return "unmatch";
  return isResolvable(row) ? "match" : null;
}

export function matchBody(lineId: number, journalLineId: number | null): MatchReconciliationBody {
  return { matches: [{ line_id: lineId, journal_line_id: journalLineId }] };
}

export const ACCEPT_SUGGESTIONS_BODY: MatchReconciliationBody = { accept_suggestions: true };

/** Ledger lines in the window that no statement line claims, in the server's order. */
/** A books-only row, which always carries its ledger line. */
export type LedgerCandidate = ReconciliationRow & { journal_line_id: number };

export function matchCandidates(lines: ReconciliationRow[]): LedgerCandidate[] {
  return lines.filter((r): r is LedgerCandidate => r.source === "ledger" && r.journal_line_id !== null);
}

function postable(account: Account): boolean {
  return account.is_active && !account.is_group;
}

export function expenseAccountChoices(accounts: Account[]): Account[] {
  return accounts.filter((a) => postable(a) && a.type === "expense");
}

/** Money accounts other than the one being reconciled. */
export function counterAccountChoices(accounts: Account[], reconciledAccountId: number): Account[] {
  return accounts.filter((a) => postable(a) && Boolean(a.cash_kind) && a.id !== reconciledAccountId);
}

export type BodyResult<T> = { ok: true; body: T } | { ok: false; reason: string };

function optionalText<K extends string>(key: K, value: string): Partial<Record<K, string>> {
  const text = value.trim();
  return text ? ({ [key]: text } as Record<K, string>) : {};
}

export function expenseRequest(form: {
  expenseAccountId: number | null;
  payee: string;
  description: string;
}): BodyResult<ReconcileLineAsExpenseBody> {
  const payee = form.payee.trim();
  if (form.expenseAccountId === null) return { ok: false, reason: "Choose the expense account." };
  if (!payee) return { ok: false, reason: "Enter the payee." };
  if (payee.length > EXPENSE_PAYEE_MAX) {
    return { ok: false, reason: `The payee can be at most ${EXPENSE_PAYEE_MAX} characters.` };
  }
  if (form.description.trim().length > EXPENSE_DESCRIPTION_MAX) {
    return { ok: false, reason: `The description can be at most ${EXPENSE_DESCRIPTION_MAX} characters.` };
  }
  return {
    ok: true,
    body: { expense_account_id: form.expenseAccountId, payee, ...optionalText("description", form.description) },
  };
}

export function transferRequest(
  form: { counterAccountId: number | null; description: string },
  reconciledAccountId: number,
): BodyResult<ReconcileLineAsTransferBody> {
  if (form.counterAccountId === null) return { ok: false, reason: "Choose the other money account." };
  if (form.counterAccountId === reconciledAccountId) {
    return { ok: false, reason: "Choose a money account other than the one being reconciled." };
  }
  if (form.description.trim().length > TRANSFER_DESCRIPTION_MAX) {
    return { ok: false, reason: `The description can be at most ${TRANSFER_DESCRIPTION_MAX} characters.` };
  }
  return {
    ok: true,
    body: { counter_account_id: form.counterAccountId, ...optionalText("description", form.description) },
  };
}

export function suspenseRequest(form: { description: string }): BodyResult<ReconcileLineToSuspenseBody> {
  if (form.description.trim().length > SUSPENSE_DESCRIPTION_MAX) {
    return { ok: false, reason: `The note can be at most ${SUSPENSE_DESCRIPTION_MAX} characters.` };
  }
  return { ok: true, body: optionalText("description", form.description) };
}
