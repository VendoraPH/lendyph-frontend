"use client";

import { useMemo, useState } from "react";
import { useBranches } from "@/hooks";
import { useAuthStore } from "@/store";
import { branchPicker } from "@/lib/user-branches";
import type { UserBranch } from "@/types";
import { approvalBranch, type ApprovalBranch } from "../_lib/approval-branch";

export interface ApprovalBranchState extends ApprovalBranch {
  /** The branches the reviewer may pick: their own, or all with See all branches. */
  offered: UserBranch[];
  loading: boolean;
  loadError: string | null;
  /** The name of the branch the registration already names, when it's in the list. */
  fixedName: string | null;
  /** The field's message: the server's refusal, or the reminder to pick one. */
  error: string | null;
  pick: (branchId: number) => void;
  setError: (message: string | null) => void;
}

/** The branch a pending registration is approved into, and its picker's state. */
export function useApprovalBranch(registrationBranchId: number | null | undefined): ApprovalBranchState {
  const { branches, loading, error: loadError } = useBranches();
  const caller = useAuthStore((s) => s.user);
  const viewAll = useAuthStore((s) => s.hasPermission("branches:view_all"));
  const offered = useMemo(() => branchPicker(branches, caller, viewAll).branches, [branches, caller, viewAll]);
  const [picked, setPicked] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choice = approvalBranch(registrationBranchId, offered, picked);
  const fixedName = choice.fixed ? (branches.find((b) => b.id === choice.branchId)?.name ?? null) : null;

  return {
    ...choice,
    offered,
    loading,
    loadError,
    fixedName,
    error,
    pick: (branchId) => {
      setPicked(branchId);
      setError(null);
    },
    setError,
  };
}
