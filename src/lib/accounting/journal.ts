/**
 * Journal entry rules: the lines a draft sends to the server's preview,
 * validating a draft, and converting it for the wire.
 *
 * The single rule everything here protects is that total debits must equal
 * total credits. The totals are the server's (`POST /accounting/journals/preview`,
 * summed exactly as posting sums them): this module parses what was typed and
 * never adds it up.
 *
 * Correcting a posted entry is done by REVERSING it on the server, never by
 * editing or deleting it. Both halves stay visible, which is what makes the
 * books auditable.
 */

import { toCentavos, formatCentavos } from "./money";
import { isPostable } from "./account";
import type {
  Account,
  JournalEntryDraft,
  JournalLine,
  JournalLineDraft,
  JournalPreview,
  JournalPreviewLine,
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
 * The lines to send to the server's preview: blank rows skipped, amounts
 * parsed by `toCentavos`, exactly as `buildJournalPayload` parses them.
 *
 * An amount that doesn't parse (mid-keystroke text, a negative) is sent as 0,
 * so the totals keep answering while someone types; validation names the line
 * on save. Both sides are sent as typed: the one-side rule is validation's.
 */
export function previewLines(draft: JournalEntryDraft): JournalPreviewLine[] {
  return draft.lines
    .filter((line) => !isBlankLine(line))
    .map((line) => ({
      account_id: line.account_id,
      debit: toCentavos(line.debit) ?? 0,
      credit: toCentavos(line.credit) ?? 0,
    }));
}

/**
 * Whether the server's preview describes a balanced entry: at least two lines,
 * a debit total above zero, and `is_balanced`. All three are server fields.
 * `is_balanced` alone is true for an empty or all-zero body (0 = 0), which
 * isn't an entry yet.
 */
export function previewIsBalanced(preview: JournalPreview | null): boolean {
  return (
    preview !== null &&
    preview.line_count >= 2 &&
    preview.total_debit > 0 &&
    preview.is_balanced
  );
}

/**
 * Full validation of a manual journal entry.
 *
 * Returns every problem at once rather than the first, so the form can mark
 * each offending row in one pass instead of making someone fix errors one
 * submit at a time.
 *
 * The balance rule reads `preview`, the server's totals for these lines
 * (`previewLines(draft)`). `null` means the answer for the current lines
 * hasn't arrived, so the balance isn't known yet and the draft can't be saved.
 */
export function validateJournalDraft(
  draft: JournalEntryDraft,
  chart: Account[],
  preview: JournalPreview | null
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
  if (!errors.some((e) => e.field === "amount" || e.field === "lines")) {
    if (preview === null) {
      errors.push({
        index: null,
        field: "balance",
        message: "The totals are still being checked. Try again in a moment.",
      });
    } else if (preview.total_debit === 0 && preview.total_credit === 0) {
      errors.push({
        index: null,
        field: "balance",
        message: "This entry records nothing — enter the amounts before posting.",
      });
    } else if (preview.line_count < 2) {
      errors.push({
        index: null,
        field: "balance",
        message: "A journal entry needs at least two lines — one debit and one credit.",
      });
    } else if (!previewIsBalanced(preview)) {
      errors.push({
        index: null,
        field: "balance",
        message: `Debits and credits differ by ${formatCentavos(
          preview.out_by
        )}. An entry must balance before it can be posted.`,
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * The shape handed to the API to create or update a manual entry: integer
 * centavos and no blank rows. No totals: the server works them out from the
 * lines (and ignored the ones this used to send).
 */
export interface JournalEntryPayload {
  date: string;
  source: JournalSource;
  reference: string | null;
  branch_id: number | null;
  description: string;
  lines: Pick<JournalLine, "account_id" | "description" | "debit" | "credit">[];
}

/**
 * A validated draft, converted for the wire.
 *
 * `JournalLineDraft.debit` and `.credit` are raw text out of an `<input>` —
 * "1,500.50", "" or garbage — and the form's own type says so. Posting a draft
 * unconverted sent that text to the API verbatim, and the damage was specific:
 * PHP casts `"1,500.50"` to `1.0` (it stops at the comma) while `"1500.50"`
 * casts to `1500.5`. So an entry the on-screen panel called "Balanced, 150050
 * both sides" reached the ledger as a ₱1.00 debit against a ₱1,500.50 credit.
 * The balance panel was right the whole time; it was reading `toCentavos` while
 * the request was not.
 *
 * Two things happen here, and both have to happen on the way OUT rather than
 * in the component, because the component is not the only possible caller and
 * the ledger is downstream of all of them:
 *
 *  1. Blank rows are dropped. The entry form always keeps a spare row on screen,
 *     and it was being shipped as `{ account_id: null, debit: "", credit: "" }`.
 *  2. Every amount goes through `toCentavos`, so grouping, a peso sign and
 *     stray whitespace are resolved here instead of by PHP's cast.
 *
 * The balance is not checked here: that needs a total, and totals are the
 * server's. The form refuses an unbalanced draft from the server's preview
 * (`validateJournalDraft`), and posting refuses it again on the server.
 *
 * Throws rather than returning errors: `validateJournalDraft` has already told
 * the user about every one of these in the form, so reaching this in a bad
 * state is a call the UI should never have made.
 */
export function buildJournalPayload(
  draft: JournalEntryDraft
): JournalEntryPayload {
  const used = draft.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => !isBlankLine(line));

  if (used.length < 2) {
    throw new Error(
      "A journal entry needs at least two lines — one debit and one credit."
    );
  }

  const lines = used.map(({ line, index }) => {
    const label = `Line ${index + 1}`;

    if (line.account_id === null) {
      throw new Error(`${label} has no account.`);
    }

    const hasDebitText = !!line.debit.trim();
    const hasCreditText = !!line.credit.trim();
    if (hasDebitText && hasCreditText) {
      throw new Error(
        `${label} has both a debit and a credit — a line can only be one side.`
      );
    }
    if (!hasDebitText && !hasCreditText) {
      throw new Error(`${label} has no amount.`);
    }

    // `toCentavos` returns null for text, negatives and malformed decimals
    // alike. Any of them here means the draft was never validated.
    const raw = hasDebitText ? line.debit : line.credit;
    const amount = toCentavos(raw);
    if (amount === null || amount <= 0) {
      throw new Error(`${label} needs a positive amount, got "${raw}".`);
    }

    return {
      account_id: line.account_id,
      description: line.description.trim() || null,
      debit: hasDebitText ? amount : 0,
      credit: hasCreditText ? amount : 0,
    };
  });

  return {
    date: draft.date,
    source: "manual",
    // "" is the form's empty reference; the API's empty is null.
    reference: draft.reference.trim() || null,
    branch_id: draft.branch_id,
    description: draft.description.trim(),
    lines,
  };
}
