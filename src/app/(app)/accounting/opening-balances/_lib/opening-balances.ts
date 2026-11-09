/**
 * The opening balances screen's rules, kept pure so they run under `tsx --test`.
 *
 * Every figure on this screen is the server's: the totals, the difference,
 * whether it balances, the 3050 line that would balance it, and whether it can
 * be finalised. The browser turns typed pesos into centavos for the save body
 * and turns the server's centavos back into text, and nothing else. It never
 * adds the lines and never balances the entry by itself.
 */

import { getErrorMessage, httpStatusOf } from "@/lib/api-error";
import { formatCentavos, toCentavos } from "@/lib/accounting/money";
import type {
  OpeningBalance,
  OpeningBalanceDraft,
  OpeningBalanceSuggestedLine,
} from "@/types";

/** One row of the editor, as typed. Amounts are peso text; blank means unused. */
export interface EditorLine {
  account_id: number | null;
  debit: string;
  credit: string;
}

export type OpeningBalanceView = "edit" | "draft_read_only" | "finalised" | "posted_elsewhere";

export const OPENING_EQUITY_LABEL = "Opening Balance Equity (3050)";
export const SAVE_TO_SEE_TOTALS = "Save to see the totals";
export const CONFLICT_MESSAGE = "Someone else changed the opening balances";
export const FINALISE_CONFIRM =
  "This posts the opening balances once. It can't be undone; correct it later with a journal entry.";
export const SUGGESTION_LABEL = "Put the difference on 3050 Opening Balance Equity";
export const SUGGESTION_REMOVE_LABEL = "Remove the 3050 Opening Balance Equity line";

const DASH = "—";
const SAVE_FALLBACK = "Could not save the opening balances.";

export function viewFor(opening: OpeningBalance): OpeningBalanceView {
  if (opening.status === "finalised") return "finalised";
  if (opening.status === "posted_elsewhere") return "posted_elsewhere";
  return opening.can_edit ? "edit" : "draft_read_only";
}

/** Server centavos as input text, by string so no float ever touches the amount. */
export function centavosToInput(centavos: number): string {
  const digits = String(Math.trunc(centavos)).padStart(3, "0");
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

const blankLine = (): EditorLine => ({ account_id: null, debit: "", credit: "" });

const toEditor = (line: { account_id: number; debit: number; credit: number }): EditorLine => ({
  account_id: line.account_id,
  debit: line.debit > 0 ? centavosToInput(line.debit) : "",
  credit: line.credit > 0 ? centavosToInput(line.credit) : "",
});

/**
 * The editor's rows: the server's `lines[]` and nothing else, or two blank rows
 * to start. A saved 3050 line is already in `lines[]` (`opening_equity_line`
 * repeats it), and the suggested line is added only when the user asks.
 */
export function editorLinesFrom(opening: OpeningBalance): EditorLine[] {
  const rows = opening.lines.map(toEditor);
  return rows.length > 0 ? rows : [blankLine(), blankLine()];
}

/** The 3050 account's id, from the server's lines only. */
export function equityAccountId(opening: OpeningBalance): number | null {
  return (
    opening.opening_equity_line?.account_id ??
    opening.suggested_opening_equity_line?.account_id ??
    null
  );
}

export interface DraftError {
  /** Editor row index, or null for the date. */
  index: number | null;
  message: string;
}

export type DraftResult =
  | {
      ok: true;
      draft: OpeningBalanceDraft;
      /** Editor row index of each line sent, so a 422 on `lines.N` finds its row. */
      rowOf: number[];
    }
  | { ok: false; errors: DraftError[] };

const isBlank = (line: EditorLine) =>
  line.account_id === null && !line.debit.trim() && !line.credit.trim();

/** Pesos with at most two decimals, after the peso sign, commas and spaces. */
const TWO_DECIMALS = /^\d+(\.\d{1,2})?$/;

function parseSide(text: string): { centavos: number } | { problem: "format" | "decimals" } | null {
  const cleaned = text.replace(/[₱,\s]/g, "");
  if (!cleaned) return null;
  if (/^\d+\.\d{3,}$/.test(cleaned)) return { problem: "decimals" };
  if (!TWO_DECIMALS.test(cleaned)) return { problem: "format" };
  const centavos = toCentavos(cleaned);
  return centavos === null ? { problem: "format" } : { centavos };
}

/** The PUT body, or the reasons it can't be sent. Blank rows are left out. */
export function buildDraft(asOf: string, lines: EditorLine[], editVersion: number): DraftResult {
  const errors: DraftError[] = [];
  const sent: OpeningBalanceDraft["lines"] = [];
  const rowOf: number[] = [];
  const firstRowOfAccount = new Map<number, number>();

  if (!asOf) errors.push({ index: null, message: "Enter the As of date." });

  lines.forEach((line, index) => {
    if (isBlank(line)) return;
    const n = index + 1;
    if (line.account_id === null) {
      errors.push({ index, message: `Choose an account on line ${n}.` });
      return;
    }
    const earlier = firstRowOfAccount.get(line.account_id);
    if (earlier !== undefined) {
      errors.push({ index, message: `Line ${n} repeats the account on line ${earlier + 1}.` });
      return;
    }
    firstRowOfAccount.set(line.account_id, index);

    const debit = parseSide(line.debit);
    const credit = parseSide(line.credit);
    for (const side of [debit, credit]) {
      if (side && "problem" in side) {
        errors.push({
          index,
          message:
            side.problem === "decimals"
              ? `Line ${n}: amounts have at most two decimals.`
              : `Line ${n}: enter the amount in pesos, like 1,500.00.`,
        });
        return;
      }
    }
    const debitCentavos = debit && "centavos" in debit ? debit.centavos : 0;
    const creditCentavos = credit && "centavos" in credit ? credit.centavos : 0;
    if (debitCentavos > 0 && creditCentavos > 0) {
      errors.push({ index, message: `Line ${n} has both a debit and a credit. Keep one.` });
      return;
    }
    if (debitCentavos === 0 && creditCentavos === 0) {
      errors.push({ index, message: `Line ${n} needs a debit or a credit above ₱0.00.` });
      return;
    }
    sent.push({ account_id: line.account_id, debit: debitCentavos, credit: creditCentavos });
    rowOf.push(index);
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, draft: { as_of: asOf, lines: sent, edit_version: editVersion }, rowOf };
}

const isZero = (line: OpeningBalanceSuggestedLine) => line.debit === 0 && line.credit === 0;

/**
 * The server's 3050 line in the rows: it replaces a 3050 row already there, or
 * is added. A ₱0.00 suggestion means the server says the 3050 line should go,
 * so that row is taken out.
 */
export function withSuggestedLine(
  lines: EditorLine[],
  suggested: OpeningBalanceSuggestedLine,
): EditorLine[] {
  if (isZero(suggested)) return lines.filter((line) => line.account_id !== suggested.account_id);
  const row = toEditor(suggested);
  const at = lines.findIndex((line) => line.account_id === suggested.account_id);
  if (at === -1) return [...lines, row];
  return lines.map((line, index) => (index === at ? row : line));
}

export interface SuggestionOffer {
  line: OpeningBalanceSuggestedLine;
  label: string;
  /** The server's figure, on its side. */
  amount: string;
}

/** Offered only for what was saved: with unsaved edits the server's figure is stale. */
export function suggestionOffer(opening: OpeningBalance, dirty: boolean): SuggestionOffer | null {
  const line = opening.suggested_opening_equity_line;
  if (!line || dirty) return null;
  if (isZero(line)) return { line, label: SUGGESTION_REMOVE_LABEL, amount: formatCentavos(0) };
  const amount =
    line.debit > 0 ? `Debit ${formatCentavos(line.debit)}` : `Credit ${formatCentavos(line.credit)}`;
  return { line, label: SUGGESTION_LABEL, amount };
}

export interface FiguresView {
  totalDebit: string;
  totalCredit: string;
  difference: string;
  balanced: string;
  hint: string | null;
}

/** The server's figures from its last answer; a dash for each while edits are unsaved. */
export function figuresView(opening: OpeningBalance, dirty: boolean): FiguresView {
  if (dirty) {
    return {
      totalDebit: DASH,
      totalCredit: DASH,
      difference: DASH,
      balanced: DASH,
      hint: SAVE_TO_SEE_TOTALS,
    };
  }
  return {
    totalDebit: formatCentavos(opening.total_debit),
    totalCredit: formatCentavos(opening.total_credit),
    difference: formatCentavos(opening.difference),
    balanced: opening.is_balanced ? "Yes" : "No",
    hint: null,
  };
}

export function postedJournalsWarning(count: number): string | null {
  if (count <= 0) return null;
  const subject = count === 1 ? "1 journal is" : `${count} journals are`;
  return `${subject} already posted on or before this date. Opening balances are usually dated before the first entry.`;
}

export interface FinaliseState {
  enabled: boolean;
  /** The server's reasons, shown when it can't be finalised. */
  reasons: string[];
  hint: string | null;
}

/** The server decides: any blocking reason disables Finalise, shown as the server sends it. */
export function finaliseState(opening: OpeningBalance, dirty: boolean): FinaliseState {
  if (!opening.can_finalise || opening.blocking_reasons.length > 0) {
    return { enabled: false, reasons: opening.blocking_reasons, hint: null };
  }
  if (dirty) {
    return { enabled: false, reasons: [], hint: "Save your changes before finalising." };
  }
  return { enabled: true, reasons: [], hint: null };
}

export type RequestFailure =
  /** Reload the entry from the server, and show its message. */
  | { kind: "reload"; message: string }
  | { kind: "error"; message: string; rows: number[] };

interface RefusalBody {
  message?: unknown;
  errors?: Record<string, unknown>;
}

const firstString = (value: unknown): string | null =>
  Array.isArray(value) && typeof value[0] === "string" && value[0] ? value[0] : null;

/**
 * A refused save or finalise, in the server's words.
 *
 * Reload on a 409 (someone else saved, or it was already posted, by this
 * screen or the command line) and on a 422 on `edit_version` (the version
 * read is no longer the draft's). `reloadOnInvalid` also reloads on any other
 * 422, for finalise: the reloaded entry carries the server's blocking reasons,
 * which then keep Finalise disabled. Other 422s stay on the form, with the
 * rows named by `lines.N.*`.
 */
export function requestFailure(
  err: unknown,
  rowOf: number[],
  fallback: string = SAVE_FALLBACK,
  options: { reloadOnInvalid?: boolean } = {},
): RequestFailure {
  const status = httpStatusOf(err);
  const body: RefusalBody =
    (err as { response?: { data?: RefusalBody } } | null)?.response?.data ?? {};
  const errors = body.errors ?? {};

  if (status === 409) {
    const sent = typeof body.message === "string" && body.message.trim() !== "";
    return {
      kind: "reload",
      message: sent ? getErrorMessage(err, fallback) : `${CONFLICT_MESSAGE}; reload and try again.`,
    };
  }
  const versionError = firstString(errors.edit_version);
  if (status === 422 && versionError) return { kind: "reload", message: versionError };
  if (status === 422 && options.reloadOnInvalid) {
    return { kind: "reload", message: getErrorMessage(err, fallback) };
  }

  const rows = Object.keys(errors).flatMap((key) => {
    const match = /^lines\.(\d+)\./.exec(key);
    const row = match ? rowOf[Number(match[1])] : undefined;
    return row === undefined ? [] : [row];
  });
  return { kind: "error", message: getErrorMessage(err, fallback), rows: [...new Set(rows)] };
}

export function postedElsewhereText(opening: OpeningBalance): string {
  const journalNo = opening.journal?.journal_no;
  return journalNo
    ? `An opening balance was already posted (${journalNo}).`
    : "An opening balance was already posted.";
}

/** Why the screen can't show anything without access to every branch; null when it can. */
export function accessNotice(canViewAllBranches: boolean): string | null {
  if (canViewAllBranches) return null;
  return "Opening balances belong to the whole organisation, not to one branch, so this screen needs access to every branch. Ask an administrator for it.";
}
