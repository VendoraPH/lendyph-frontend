/**
 * What the journal page offers for one entry: edit and post a draft, reverse a
 * posted entry that isn't itself a reversal. A year-end closing entry is
 * undone only by reopening its year, so its Reverse is disabled with that
 * reason (the server refuses it, and the reversal of one, with 422). An action the status doesn't allow, or the user's role can't
 * take, is hidden. One that is offered but can't be taken right now carries
 * the reason, for a disabled button.
 */
import { previewIsBalanced } from "@/lib/accounting/journal";
import { closedYear } from "@/lib/accounting/source-document";
import type { JournalEntry, JournalPreview, Permission } from "@/types";

export type JournalAction = "edit" | "post" | "reverse";

export interface JournalActionState {
  shown: boolean;
  /** Why the shown button is disabled; null when it can be used. */
  disabledReason: string | null;
}

const HIDDEN: JournalActionState = { shown: false, disabledReason: null };
const READY: JournalActionState = { shown: true, disabledReason: null };

/**
 * A draft's stored lines by the server's preview. `unknown` only for a poster
 * without journals:create, who can't ask for the preview: Post stays open and
 * the server re-checks the balance when posting.
 */
export type DraftBalance = "balanced" | "unbalanced" | "pending" | "failed" | "unknown";

export function draftBalance({
  canPreview,
  preview,
  failed,
}: {
  canPreview: boolean;
  preview: JournalPreview | null;
  failed: string | null;
}): DraftBalance {
  if (!canPreview) return "unknown";
  if (failed !== null) return "failed";
  if (preview === null) return "pending";
  return previewIsBalanced(preview) ? "balanced" : "unbalanced";
}

const POST_WAITS: Record<DraftBalance, string | null> = {
  balanced: null,
  unknown: null,
  unbalanced: "Debits and credits don't balance yet. Edit the draft before posting.",
  pending: "Checking the totals…",
  failed: "The totals couldn't be checked",
};

function reverseRefusal(
  entry: Pick<JournalEntry, "reversed_by_journal_id"> & Partial<Pick<JournalEntry, "source" | "date">>,
): string | null {
  if (entry.source === "closing") {
    const year = closedYear(entry.date);
    return year
      ? `This entry is part of the ${year} year-end close. Reopen the year instead.`
      : "This entry is part of a year-end close. Reopen the year instead.";
  }
  return entry.reversed_by_journal_id ? "This entry has already been reversed." : null;
}

export function journalActions(
  entry: Pick<JournalEntry, "status" | "reversed_by_journal_id" | "reverses_journal_id"> &
    Partial<Pick<JournalEntry, "source" | "date">>,
  can: (permission: Permission) => boolean,
  { editing, balance }: { editing: boolean; balance: DraftBalance },
): Record<JournalAction, JournalActionState> {
  const isDraft = entry.status === "draft";
  const isPosted = entry.status === "posted";
  /** A reversal is never reversed itself: it is the correction (a year's reopen included). */
  const isReversal = Boolean(entry.reverses_journal_id);

  return {
    edit: isDraft && can("journals:create") ? READY : HIDDEN,
    post:
      isDraft && can("journals:post")
        ? {
            shown: true,
            disabledReason: editing
              ? "Save or cancel your changes before posting."
              : POST_WAITS[balance],
          }
        : HIDDEN,
    reverse:
      isPosted && !isReversal && can("journals:reverse")
        ? { shown: true, disabledReason: reverseRefusal(entry) }
        : HIDDEN,
  };
}
