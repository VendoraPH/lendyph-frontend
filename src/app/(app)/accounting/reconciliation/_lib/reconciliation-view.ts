import { signedCentavos } from "./signed-money";
import { getErrorMessage, httpStatusOf } from "@/lib/api-error";
import { formatDate } from "@/lib/format";
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

/**
 * A row's status in words. An outstanding entry whose reversal pair nets to
 * zero (the server's `netted`) is left out of the outstanding count, so it
 * reads as such rather than "Unmatched".
 */
export function rowMatchLabel(row: ReconciliationRow): string {
  return row.netted ? NETTED : matchLabel(row.match);
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
    { key: "statement", label: "Statement balance", value: signedCentavos(r.statement_balance), money: true },
    { key: "book", label: "Book balance", value: signedCentavos(r.book_balance), money: true },
    { key: "difference", label: "Difference", value: signedCentavos(r.difference), money: true },
    { key: "matched", label: "Matched", value: String(r.matched_count), money: false },
    { key: "possible", label: "Possible matches", value: String(r.possible_count), money: false },
    { key: "unmatched", label: "Unmatched", value: String(r.unmatched_count), money: false },
    {
      key: "outstanding",
      label: "Outstanding items",
      value: r.outstanding_count === undefined ? "—" : String(r.outstanding_count),
      money: false,
    },
  ];
}

/** The ledger line a row is matched to or suggested for, or which side it is missing from. */
export function ledgerLineText(row: ReconciliationRow): string {
  if (row.source === "ledger") {
    if (row.netted) return NETTED;
    return row.outside_period ? `Outstanding from ${formatDate(row.date)}` : "Not on the statement";
  }
  if (row.source === "statement") return "Not in the books";
  const entry = row.journal_no ?? "a ledger line";
  return row.match === "possible" ? `Suggested: ${entry}` : `Matched to ${entry}`;
}

/** An outstanding entry whose reversal pair nets to zero, left out of the outstanding count. */
const NETTED = "Outstanding, nets to zero";

/** The label on a paired row's books figures: "Books entry JE-…". Null on a row with one side only. */
export function pairedFiguresCaption(row: ReconciliationRow): string | null {
  if (row.source !== "both") return null;
  return row.journal_no ? `Books entry ${row.journal_no}` : "Books entry";
}

export interface RowFigures {
  date: string;
  amount: string;
  /** The line under each figure: on a paired row, whose figure it is, or the books entry's own. */
  dateNote: string | null;
  amountNote: string | null;
}

/**
 * The date and amount a statement row shows. A paired row shows the statement
 * line's own (`statement_date`, `statement_amount`), with the books entry's
 * labelled under them. From an API that sends no statement figures, it shows
 * the books entry's, labelled as such. Every figure is the server's.
 */
export function rowFigures(row: ReconciliationRow): RowFigures {
  const date = formatDate(row.date);
  const amount = signedCentavos(row.amount);
  const caption = pairedFiguresCaption(row);
  if (caption === null) return { date, amount, dateNote: null, amountNote: null };

  const { statement_date: statementDate, statement_amount: statementAmount } = row;
  const hasDate = typeof statementDate === "string";
  const hasAmount = typeof statementAmount === "number";
  return {
    date: hasDate ? formatDate(statementDate) : date,
    amount: hasAmount ? signedCentavos(statementAmount) : amount,
    dateNote: hasDate ? `${caption}: ${date}` : caption,
    amountNote: hasAmount ? `${caption}: ${amount}` : caption,
  };
}

/** A hand-match candidate's date, marked when it is an outstanding item from before the period. */
export function candidateDateText(row: ReconciliationRow): string {
  if (!row.outside_period) return formatDate(row.date);
  const outstanding = `Outstanding from ${formatDate(row.date)}`;
  return row.netted ? `${outstanding}, nets to zero` : outstanding;
}

/**
 * A hand-match candidate's title. A suggested pair carries the statement
 * line's description, not the entry's, so it names the line it is suggested for.
 */
export function candidateTitle(row: ReconciliationRow): string {
  return row.source === "both" ? `Suggested for the statement line "${row.description}"` : row.description;
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

/** A branch user with no branch: each reconciliation proves one branch's books, so they can't start one. */
export const NO_BRANCH_ASSIGNED =
  "You have no branch assigned, so you can't start a reconciliation. Ask an administrator to assign you a branch.";

/**
 * A 403 to a branch user. Each branch reconciles its own books; the "All
 * branches" reconciliations, and other branches', need wider access.
 */
export const BRANCH_ACCESS_EXPLANATION =
  "You can reconcile your own branches' books only. The reconciliations of all branches, and of other branches, need access to those branches. Ask an administrator if you need it.";

interface AccessContext {
  canViewAll: boolean;
}

export interface RequestFailure {
  /** A 409: the worksheet changed underneath, so it is read again. */
  reload: boolean;
  message: string;
  /**
   * A 422 on a line the books already hold: offer "Match it instead" or
   * "Record anyway" (the same request with `record_anyway: true`).
   */
  inBooks?: true;
}

/** C5's wording for that refusal: "This statement line matches JE-… already in the books. …". */
const ALREADY_IN_THE_BOOKS = /already in the books/i;

function lineErrors(err: unknown): string[] {
  const line = (err as { response?: { data?: { errors?: { line?: unknown } } } })?.response?.data?.errors?.line;
  return Array.isArray(line) ? line.filter((m): m is string => typeof m === "string") : [];
}

/** A refused write in words: the server's own for 409 and 422, and an explained 403. */
export function requestFailure(err: unknown, { canViewAll }: AccessContext): RequestFailure {
  const status = httpStatusOf(err);
  if (status === 403 && !canViewAll) return { reload: false, message: BRANCH_ACCESS_EXPLANATION };
  const inBooks = status === 422 ? lineErrors(err).find((m) => ALREADY_IN_THE_BOOKS.test(m)) : undefined;
  if (inBooks) return { reload: false, message: inBooks, inBooks: true };
  return { reload: status === 409, message: getErrorMessage(err) };
}

/**
 * The refusal of a hand match whose amount or side differs from the statement
 * line's ("This statement line is ₱88.00 out; the entry is ₱2,000.00 in.").
 */
const AMOUNT_OR_SIDE_DIFFERS = /^This statement line is .+; the entry is /i;

function matchErrors(err: unknown): string[] {
  const matches = (err as { response?: { data?: { errors?: { matches?: unknown } } } })?.response?.data?.errors
    ?.matches;
  return Array.isArray(matches) ? matches.filter((m): m is string => typeof m === "string") : [];
}

/**
 * A refused match. Besides the 409s, a 422 (a draft entry, or a leg that wasn't
 * live at the period end) means the worksheet offered something stale, so it
 * shows the server's words and is read again. A 422 for a different amount or
 * side is the choice, not the worksheet: its words show in place, with no reload.
 */
export function matchFailure(err: unknown, context: AccessContext): RequestFailure {
  const failure = requestFailure(err, context);
  if (httpStatusOf(err) !== 422) return failure;
  const differs = matchErrors(err).find((m) => AMOUNT_OR_SIDE_DIFFERS.test(m));
  if (differs) return { reload: false, message: differs };
  return { reload: true, message: getErrorMessage(err) };
}

export function loadFailure(err: unknown, { canViewAll }: AccessContext): string {
  const status = httpStatusOf(err);
  if (status === 403 && !canViewAll) return BRANCH_ACCESS_EXPLANATION;
  if (status === 404) {
    return canViewAll
      ? "This reconciliation doesn't exist, or it was removed."
      : "This reconciliation doesn't exist, or it covers a branch you don't have access to.";
  }
  return getErrorMessage(err, "The reconciliation couldn't be loaded.");
}

/**
 * What the page offers when a reconciliation can't be loaded: trying again
 * can't help a 404 (or a 403), so those offer the way back to the list.
 */
export function loadRecovery(err: unknown): "back" | "retry" {
  const status = httpStatusOf(err);
  return status === 404 || status === 403 ? "back" : "retry";
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
