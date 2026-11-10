"use client";

import { useId } from "react";
import { useBranches } from "@/hooks";
import { ALL_BRANCHES, branchFilterOptions } from "@/lib/branch-filter";
import { useAuthStore } from "@/store";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export { ALL_BRANCHES, branchIdParam } from "@/lib/branch-filter";

interface BranchFilterProps {
  /** `ALL_BRANCHES` or a branch id as text; send it with `branchIdParam`. */
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Branch select for a list's server-side `branch_id` filter. It offers only
 * the caller's own branches ("All my branches") unless they hold
 * `branches:view_all`.
 *
 * Import it by path: it loads the branch list, so it stays out of the
 * `components/common/index.ts` barrel.
 */
export function BranchFilter({ value, onChange, className }: BranchFilterProps) {
  const id = useId();
  const { branches } = useBranches();
  const caller = useAuthStore((s) => s.user);
  const viewAll = useAuthStore((s) => s.hasPermission("branches:view_all"));
  const options = branchFilterOptions(branches, caller, viewAll);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        Branch
      </Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v ?? ALL_BRANCHES)}
        items={options.items}
      >
        <SelectTrigger id={id} className={className ?? "w-[180px]"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
