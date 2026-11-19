"use client";

import { useEffect, useMemo } from "react";
import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranches } from "@/hooks";
import { useWorkingBranch } from "@/hooks/use-working-branch";
import { branchIdParam } from "@/lib/branch-filter";
import { branchViewer, userBranches } from "@/lib/user-branches";
import {
  workingBranchFor,
  workingBranchSelector,
  workingBranchSelectorValue,
} from "@/lib/working-branch";
import { useAuthStore } from "@/store";

/**
 * The header's working-branch selector (behind NEXT_PUBLIC_ENABLE_MULTI_BRANCH).
 * It offers only the caller's branches (`GET /branches` is scoped), after "All
 * branches" (view_all) or "All my branches"; one branch reads as plain text. It only presets
 * the pages' filters and pickers: the server never trusts it.
 */
export function WorkingBranchSelector() {
  const user = useAuthStore((s) => s.user);
  const { enabled, viewAll, stored, setBranchId } = useWorkingBranch();
  const { branches, loading, error } = useBranches(enabled);
  const own = useMemo(() => userBranches(user), [user]);
  const loaded = !loading && error === null;
  const listed = loaded ? branches : [];
  const working = workingBranchFor({ enabled, stored, viewer: branchViewer(user, viewAll), listed });

  // A stored branch the user may no longer work in (unassigned, or inactive
  // once the list loads) is forgotten, so no page presets it.
  useEffect(() => {
    if (stored !== null && working === null) setBranchId(null);
  }, [stored, working, setBranchId]);

  if (!enabled) return null;
  const selector = workingBranchSelector({ viewAll, own, listed });
  if (selector.kind === "none") return null;

  if (selector.kind === "single") {
    return (
      <span className="flex min-w-0 max-w-[9rem] items-center gap-1.5 text-sm text-muted-foreground sm:max-w-[14rem]">
        <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">Working branch: </span>
        <span className="truncate">{selector.branch.name}</span>
      </span>
    );
  }

  return (
    <Select
      value={workingBranchSelectorValue(working)}
      onValueChange={(v) => setBranchId(v === null ? null : (branchIdParam(v) ?? null))}
      items={selector.items}
    >
      <SelectTrigger
        size="sm"
        aria-label="Working branch"
        title="Working branch: presets each page's branch filter"
        className="max-w-[9rem] sm:max-w-[14rem]"
      >
        <Building2 className="text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 truncate">
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {selector.items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
