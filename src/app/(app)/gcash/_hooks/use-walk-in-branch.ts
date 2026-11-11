import { useState } from "react";
import { useBranchChoiceSource } from "@/hooks/use-branch-choice-source";
import type { GCashParty } from "@/types";
import {
  branchRefusal,
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
  /** The body's `branch_id` part, or null after showing why it can't be sent. */
  take: () => WalkInBranchBody | null;
  /** Shows the server's refusal of `branch_id` (422) beside the field. */
  showRefusal: (err: unknown) => void;
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
    take: () => {
      const payload = walkInBranchPayload(choice, value);
      if (payload.ok) return payload.body;
      setError(payload.message);
      return null;
    },
    showRefusal: (err) => setError(branchRefusal(err)),
  };
}
