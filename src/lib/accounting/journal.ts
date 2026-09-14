/**
 * Journal entry rules: totalling a draft, validating it, and reversing a
 * posted one.
 *
 * The single rule everything here protects is that total debits must equal
 * total credits. A journal that fails it cannot be posted, because an
 * unbalanced entry propagates into the trial balance and every statement built
 * on top of it, and there is no way to find it afterwards except by hand.
 *
 * Correcting a posted entry is done by REVERSING it, never by editing or
 * deleting it. Both halves stay visible, which is what makes the books
 * auditable.
 */

import { toCentavos, sumCentavos, formatCentavos } from "./money";
import { isPostable } from "./account";
import type {
  Account,
  JournalEntry,
  JournalEntryDraft,
  JournalLine,
  JournalLineDraft,
  JournalSource,
} from "@/types/accounting";

export type JournalErrorField =
  | "date"
  | "description"
  | "account"
  | "amount"
  | "balance"
  | "lines";

export interface JournalError {
  /** Row index for line-level errors, `null` for entry-level ones. */
  index: number | null;
  field: JournalErrorField;
  message: string;
}

export interface JournalSummary {
  total_debit: number;
  total_credit: number;
  /** `total_debit - total_credit`, in centavos. Zero when balanced. */
  difference: number;
  is_balanced: boolean;
}

export interface JournalValidation {
  ok: boolean;
  errors: JournalError[];
}

/** A blank row for the manual entry table. */
export function emptyLine(): JournalLineDraft {
  return { account_id: null, description: "", debit: "", credit: "" };
}

/**
 * True when the row holds nothing at all.
 *
 * The entry form always keeps a spare row on screen, so an untouched row is
 * not a mistake — it is simply unused, and is skipped rather than flagged.
 */
export function isBlankLine(line: JournalLineDraft): boolean {
  return (
    line.account_id === null &&
    !line.description.trim() &&
    !line.debit.trim() &&
    !line.credit.trim()
  );
}

/**
 * Running totals for the draft, for the live "Total Debit / Total Credit /
 * Difference" footer. Amounts that do not parse count as nothing, so the
 * footer keeps updating while someone is mid-keystroke instead of blanking.
 */
export function summariseDraft(draft: JournalEntryDraft): JournalSummary {
  const rows = draft.lines.filter((line) => !isBlankLine(line));
  const total_debit = sumCentavos(rows.map((line) => toCentavos(line.debit)));
  const total_credit = sumCentavos(rows.map((line) => toCentavos(line.credit)));
  const difference = total_debit - total_credit;
  return {
    total_debit,
    total_credit,
    difference,
    is_balanced: difference === 0,
  };
}

/**
 * Full validation of a manual journal entry.
 *
 * Returns every problem at once rather than the first, so the form can mark
 * each offending row in one pass instead of making someone fix errors one
 * submit at a time.
 */
export function validateJournalDraft(
  draft: JournalEntryDraft,
  chart: Account[]
): JournalValidation {
  const errors: JournalError[] = [];
  const byId = new Map(chart.map((a) => [a.id, a]));

  if (!draft.date.trim()) {
    errors.push({ index: null, field: "date", message: "Choose a journal date." });
  }
  if (!draft.description.trim()) {
    errors.push({
      index: null,
      field: "description",
      message: "Describe what this entry is for.",
    });
  }

  const used = draft.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => !isBlankLine(line));

  if (used.length < 2) {
    errors.push({
      index: null,
      field: "lines",
      message: "A journal entry needs at least two lines — one debit and one credit.",
    });
  }

  for (const { line, index } of used) {
    const label = `Line ${index + 1}`;

    // Account must exist, be active, and not be a group header.
    if (line.account_id === null) {
      errors.push({
        index,
        field: "account",
        message: `Select an account for ${label}.`,
      });
    } else {
      const account = byId.get(line.account_id);
      if (!account) {
        errors.push({
          index,
          field: "account",
          message: `${label} refers to an account that no longer exists.`,
        });
      } else if (!isPostable(account)) {
        errors.push({
          index,
          field: "account",
          message: account.is_group
            ? `${account.code} ${account.name} is a heading — post to one of its sub-accounts instead.`
            : `${account.code} ${account.name} is inactive and cannot take new entries.`,
        });
      }
    }

    // Exactly one side, and it must parse to a usable amount.
    const hasDebitText = !!line.debit.trim();
    const hasCreditText = !!line.credit.trim();
    const debit = toCentavos(line.debit);
    const credit = toCentavos(line.credit);

    if (hasDebitText && hasCreditText) {
      errors.push({
        index,
        field: "amount",
        message: `${label} has both a debit and a credit — a line can only be one side.`,
      });
    } else if (!hasDebitText && !hasCreditText) {
      errors.push({
        index,
        field: "amount",
        message: `Enter a debit or a credit for ${label}.`,
      });
    } else if ((hasDebitText && debit === null) || (hasCreditText && credit === null)) {
      // Covers text, negatives and malformed decimals alike — `toCentavos`
      // refuses all three, and the remedy the person needs is the same.
      errors.push({
        index,
        field: "amount",
        message: `${label} needs a positive amount.`,
      });
    }
  }

  // The central rule, checked last so a real imbalance is not reported on top
  // of rows that are simply still being filled in.
  const summary = summariseDraft(draft);
  if (!errors.some((e) => e.field === "amount" || e.field === "lines")) {
    if (summary.total_debit === 0 && summary.total_credit === 0) {
      errors.push({
        index: null,
        field: "balance",
        message: "This entry records nothing — enter the amounts before posting.",
      });
    } else if (!summary.is_balanced) {
      errors.push({
        index: null,
        field: "balance",
        message: `Debits and credits differ by ${formatCentavos(
          Math.abs(summary.difference)
        )}. An entry must balance before it can be posted.`,
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

/** The shape handed to the API to create a reversing entry. */
export interface ReversalDraft {
  date: string;
  source: JournalSource;
  reference: string | null;
  description: string;
  branch_id: number | null;
  reverses_journal_id: number;
  lines: Pick<JournalLine, "account_id" | "debit" | "credit">[];
  total_debit: number;
  total_credit: number;
}

/**
 * The mirror image of a posted entry.
 *
 * Every debit becomes a credit and vice versa, against the same accounts, so
 * the pair nets to zero while both remain on the record. The original is never
 * modified — `status` moves to `reversed` and `reversed_by_journal_id` is set
 * by the server when the reversal posts.
 *
 * Throws rather than returning an error object: reversing a draft or a
 * already-reversed entry is not user input to be validated, it is a call the
 * UI should never have made, and failing loudly surfaces that in development.
 */
export function buildReversal(
  entry: JournalEntry,
  date: string
): ReversalDraft {
  if (entry.status === "reversed" || entry.reversed_by_journal_id) {
    throw new Error(
      `Journal ${entry.journal_no} has already been reversed.`
    );
  }
  if (entry.status !== "posted") {
    throw new Error(
      `Only a posted journal can be reversed; ${entry.journal_no || "this entry"} is a draft.`
    );
  }

  const lines = entry.lines.map((line) => ({
    account_id: line.account_id,
    debit: line.credit,
    credit: line.debit,
  }));

  return {
    date,
    source: "reversal",
    reference: entry.reference ?? null,
    description: `Reversal of ${entry.journal_no} — ${entry.description}`,
    branch_id: entry.branch_id,
    reverses_journal_id: entry.id,
    lines,
    total_debit: sumCentavos(lines.map((l) => l.debit)),
    total_credit: sumCentavos(lines.map((l) => l.credit)),
  };
}
