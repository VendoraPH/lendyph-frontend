import { useMemo } from "react";
import type { BranchChoiceSource } from "@/lib/branch-choice";
import { userBranches } from "@/lib/user-branches";
import type { ApiBranch } from "@/services/branch.service";
import { useAuthStore } from "@/store";
import type { UserBranch } from "@/types";
import { useBranches } from "./use-branches";

export interface BranchChoiceState extends BranchChoiceSource<UserBranch | ApiBranch> {
  /** True while a view_all caller's branch list is loading. */
  loading: boolean;
}

/**
 * What a form's branch choice is built from (`@/lib/branch-choice`): the
 * caller's own branches, `branches:view_all`, and, for view_all only, the
 * branch list. A caller without view_all picks only their own, so nothing is
 * requested for them, nor when `enabled` is false.
 */
export function useBranchChoiceSource(enabled = true): BranchChoiceState {
  const user = useAuthStore((s) => s.user);
  const viewAll = useAuthStore((s) => s.hasPermission("branches:view_all"));
  const { branches, loading } = useBranches(enabled && viewAll);
  const own = useMemo(() => userBranches(user), [user]);
  return { viewAll, own, listed: branches, loading };
}
