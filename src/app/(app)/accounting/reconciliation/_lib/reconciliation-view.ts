import { formatCentavos } from "@/lib/accounting/money";
import { getErrorMessage, httpStatusOf } from "@/lib/api-error";
import type { ReconciliationMatch } from "@/types";
import type {
  CreatedRecord,
  ReconciliationActionAnswer,
  ReconciliationDetail,
  ReconciliationRow,
} from "./types";

/**
 * How the worksheet reads. Every figure and count is the server's, shown as
 * sent: the browser formats them and never works one out again.
 */

const MATCH_LABELS: Record<ReconciliationMatch, string> = {
  matched: "Matched",
  unmatched: "Unmatched",
  possible: "Possible match",
};

export function matchLabel(match: ReconciliationMatch): string {
  return MATCH_LABELS[match];
}

export function reconciledLabel(reconciliation: ReconciliationDetail): string {
  return reconciliation.is_reconciled ? "Reconciled" : "Not reconciled";
}

export function directionLabel(amount: number): string {
  return amount < 0 ? "Money out" : "Money in";
}

export function accountLabel(reconciliation: ReconciliationDetail): string {
  return [reconciliation.account_code, reconciliation.account_name].filter(Boolean).join(" ") || "—";
}

export interface HeaderFigure {
  key: string;
  label: string;
  value: string;
  money: boolean;
}

export function headerFigures(r: ReconciliationDetail): HeaderFigure[] {
  return [
    { key: "statement", label: "Statement balance", value: formatCentavos(r.statement_balance), money: true },
    { key: "book", label: "Book balance", value: formatCentavos(r.book_balance), money: true },
    { key: "difference", label: "Difference", value: formatCentavos(r.difference), money: true },
    { key: "matched", label: "Matched", value: String(r.matched_count), money: false },
    { key: "possible", label: "Possible matches", value: String(r.possible_count), money: false },
    { key: "unmatched", label: "Unmatched", value: String(r.unmatched_count), money: false },
  ];
}

/** The ledger line a row is matched to or suggested for, or which side it is missing from. */
export function ledgerLineText(row: ReconciliationRow): string {
  if (row.source === "ledger") return "Not on the statement";
  if (row.source === "statement") return "Not in the books";
  const entry = row.journal_no ?? "a ledger line";
  return row.match === "possible" ? `Suggested: ${entry}` : `Matched to ${entry}`;
}

export function journalHref(journalId: number): string {
  return `/accounting/journals/${journalId}`;
}

const CREATED_TYPE_LABELS: Record<CreatedRecord["type"], string> = {
  expense: "expense",
  transfer: "transfer",
  journal: "suspense entry",
};

export interface CreatedNotice {
  text: string;
  href: string;
}

export function createdNotice(created: CreatedRecord): CreatedNotice {
  return {
    text: `Recorded as ${CREATED_TYPE_LABELS[created.type]} ${created.journal_no}`,
    href: journalHref(created.journal_id),
  };
}

export interface WorksheetState {
  reconciliation: ReconciliationDetail;
  notice: CreatedNotice | null;
}

/** The worksheet after an action: exactly the response's `data`, with the record it made. */
export function afterAction(answer: ReconciliationActionAnswer): WorksheetState {
  return { reconciliation: answer.data, notice: createdNotice(answer.created) };
}

export const BRANCH_ACCESS_EXPLANATION =
  "Reconciliation reads every branch's books, so it is done at head office and needs access to all branches. Ask an administrator to give your role access to all branches.";

interface AccessContext {
  canViewAll: boolean;
}

export interface RequestFailure {
  /** A 409: the worksheet changed underneath, so it is read again. */
  reload: boolean;
  message: string;
}

/** A refused write in words: the server's own for 409 and 422, and an explained 403. */
export function requestFailure(err: unknown, { canViewAll }: AccessContext): RequestFailure {
  const status = httpStatusOf(err);
  if (status === 403 && !canViewAll) return { reload: false, message: BRANCH_ACCESS_EXPLANATION };
  return { reload: status === 409, message: getErrorMessage(err) };
}

export function loadFailure(err: unknown, { canViewAll }: AccessContext): string {
  const status = httpStatusOf(err);
  if (status === 403 && !canViewAll) return BRANCH_ACCESS_EXPLANATION;
  if (status === 404) return "This reconciliation doesn't exist, or it was removed.";
  return getErrorMessage(err, "The reconciliation couldn't be loaded.");
}

/** The suspense role's default account, as C5's confirm names it. */
export const SUSPENSE_ACCOUNT = "2390 Suspense Account";

/** What "Move to suspense" posts, side by side, and why it can't stay there. */
export function suspenseConfirmation(
  row: ReconciliationRow,
  reconciledAccount: string,
): { entry: string; warning: string } {
  const entry =
    row.amount < 0
      ? `Debit ${SUSPENSE_ACCOUNT}, credit ${reconciledAccount}.`
      : `Debit ${reconciledAccount}, credit ${SUSPENSE_ACCOUNT}.`;
  return {
    entry,
    warning: `This posts a journal entry now and matches the line to it. ${SUSPENSE_ACCOUNT} is a holding account: the amount must be cleared later, once you know what the line was, by posting it to the right account.`,
  };
}

export function transferDirection(row: ReconciliationRow, reconciledAccount: string): string {
  return row.amount < 0
    ? `Money out: it moves from ${reconciledAccount} to the account you pick.`
    : `Money in: it moves from the account you pick into ${reconciledAccount}.`;
}

/** The description C5 writes when the field is left empty, shown as the placeholder. */
export function descriptionDefault(kind: "expense" | "transfer", row: ReconciliationRow): string {
  return kind === "expense" ? row.description : `Transfer from statement line: ${row.description}`;
}
