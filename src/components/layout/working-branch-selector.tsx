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
import { LOADING_BRANCHES, branchIdParam } from "@/lib/branch-filter";
import { branchViewer, userBranches } from "@/lib/user-branches";
import {
  selectorShownValue,
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
  const { enabled, viewAll, stored, storedName, setBranch } = useWorkingBranch();
  const { branches, loading, error } = useBranches(enabled);
  const own = useMemo(() => userBranches(user), [user]);
  const loaded = !loading && error === null;
  const listed = loaded ? branches : [];
  const working = workingBranchFor({ enabled, stored, viewer: branchViewer(user, viewAll), listed });

  // A stored branch the user may no longer work in (unassigned, or inactive
  // once the list loads) is forgotten, so no page presets it.
  useEffect(() => {
    if (stored !== null && working === null) setBranch(null);
  }, [stored, working, setBranch]);

  if (!enabled) return null;
  const selector = workingBranchSelector({
    viewAll,
    own,
    listed,
    stored: stored === null ? null : { id: stored, name: storedName },
  });
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

  const { items } = selector;
  // A branch its items don't name yet (no stored name, list loading) shows a
  // loading state, never its id.
  const value = selectorShownValue(workingBranchSelectorValue(working), items);
  const pick = (v: string | null) => {
    const id = v === null ? undefined : branchIdParam(v);
    const label = items.find((i) => i.value === v)?.label;
    setBranch(id === undefined || label === undefined ? null : { id, name: label });
  };

  return (
    <Select value={value} onValueChange={pick} items={items}>
      <SelectTrigger
        size="sm"
        aria-label="Working branch"
        title="Working branch: presets each page's branch filter"
        className="max-w-[9rem] sm:max-w-[14rem]"
      >
        <Building2 className="text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 truncate">
          <SelectValue placeholder={LOADING_BRANCHES} />
        </span>
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
