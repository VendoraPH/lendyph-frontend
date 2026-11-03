"use client";

import { useBranches } from "@/hooks";
import { branchFilterItems, branchPicker } from "@/lib/user-branches";
import { useAuthStore } from "@/store";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** "All branches" as a Select value — a Select cannot hold an empty string. */
export const ALL_BRANCHES = "all";

interface BranchFilterProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Branch select for a list's server-side `branch_id` filter. Import by path:
 * it loads the branch list, so it stays out of `components/common/index.ts`.
 */
export function BranchFilter({ value, onChange }: BranchFilterProps) {
  const { branches } = useBranches();
  // Without `branches:view_all` the API answers 403 to a branch outside the
  // caller's own, so only theirs are offered (branchPicker).
  const caller = useAuthStore((s) => s.user);
  const viewAll = useAuthStore((s) => s.hasPermission("branches:view_all"));
  const picker = branchPicker(branches, caller, viewAll);
  const items = branchFilterItems(branches, ALL_BRANCHES, picker.viewer);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Branch</Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v ?? ALL_BRANCHES)}
        items={items}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_BRANCHES}>{picker.allLabel}</SelectItem>
          {picker.branches.map((branch) => (
            <SelectItem key={branch.id} value={String(branch.id)}>
              {branch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
