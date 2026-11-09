/**
 * What the journal page offers for one entry: edit and post a draft, reverse a
 * posted entry. An action the status doesn't allow, or the user's role can't
 * take, is hidden. One that is offered but can't be taken right now carries
 * the reason, for a disabled button.
 */
import type { JournalEntry, Permission } from "@/types";

export type JournalAction = "edit" | "post" | "reverse";

export interface JournalActionState {
  shown: boolean;
  /** Why the shown button is disabled; null when it can be used. */
  disabledReason: string | null;
}

const HIDDEN: JournalActionState = { shown: false, disabledReason: null };
const READY: JournalActionState = { shown: true, disabledReason: null };

export function journalActions(
  entry: Pick<JournalEntry, "status" | "reversed_by_journal_id">,
  can: (permission: Permission) => boolean,
  {
    editing,
    balanced = null,
  }: {
    editing: boolean;
    /**
     * A draft's balance by the server's preview of its stored lines
     * (`previewIsBalanced`); null when it couldn't be asked, and the server
     * decides on posting.
     */
    balanced?: boolean | null;
  },
): Record<JournalAction, JournalActionState> {
  const isDraft = entry.status === "draft";
  const isPosted = entry.status === "posted";

  return {
    edit: isDraft && can("journals:create") ? READY : HIDDEN,
    post:
      isDraft && can("journals:post")
        ? {
            shown: true,
            disabledReason: editing
              ? "Save or cancel your changes before posting."
              : balanced === false
                ? "Debits and credits don't balance yet. Edit the draft before posting."
                : null,
          }
        : HIDDEN,
    reverse:
      isPosted && can("journals:reverse")
        ? {
            shown: true,
            disabledReason: entry.reversed_by_journal_id
              ? "This entry has already been reversed."
              : null,
          }
        : HIDDEN,
  };
}
