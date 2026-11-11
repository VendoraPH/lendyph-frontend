import { useId, useState } from "react";
import { toast } from "sonner";
import { useBranchChoiceSource } from "@/hooks/use-branch-choice-source";
import type { GCashParty } from "@/types";
import {
  gcashSaveFailure,
  walkInBranchBlocked,
  walkInBranchChoice,
  walkInBranchPayload,
  type WalkInBranchBody,
  type WalkInBranchChoice,
} from "../_lib/walk-in-branch";

export interface WalkInBranch {
  choice: WalkInBranchChoice;
  /** The picker's value: the preselection until the user picks. */
  value: string | null;
  setValue: (value: string | null) => void;
  /** The form's or the server's words about the branch. */
  error: string | null;
  loading: boolean;
  /** No branch and no view_all: Record stays disabled, and the field says why. */
  blocked: boolean;
  /** The id of the field's reason, for the disabled Record button's `aria-describedby`. */
  reasonId: string;
  /** The body's `branch_id` part, or null after showing why it can't be sent. */
  take: () => WalkInBranchBody | null;
  /**
   * Shows a refused save once: the server's words about `branch_id` (422)
   * beside the field, any other refusal as a toast.
   */
  showFailure: (err: unknown) => void;
}

/**
 * The Cash In / Cash Out form's branch, for a walk-in. A member's transaction
 * gets `kind: "member"` and nothing is requested. The dialogs mount afresh
 * for each transaction, so the pick needs no reset.
 */
export function useWalkInBranch(party: GCashParty): WalkInBranch {
  const source = useBranchChoiceSource(party.kind === "non_member");
  const choice = walkInBranchChoice(party.kind, source);
  const [picked, setPicked] = useState<{ value: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reasonId = useId();
  const value = picked ? picked.value : choice.kind === "pick" ? choice.preselected : null;

  return {
    choice,
    value,
    setValue: (next) => {
      setPicked({ value: next });
      setError(null);
    },
    error,
    loading: source.loading,
    blocked: walkInBranchBlocked(choice),
    reasonId,
    take: () => {
      const payload = walkInBranchPayload(choice, value);
      if (payload.ok) return payload.body;
      setError(payload.message);
      return null;
    },
    showFailure: (err) => {
      const failure = gcashSaveFailure(err);
      setError(failure.field);
      if (failure.toast !== null) toast.error(failure.toast);
    },
  };
}
