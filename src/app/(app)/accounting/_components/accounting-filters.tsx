"use client";

import { useBranches } from "@/hooks";
import {
  allBranchesLabel,
  branchFilterItems,
  branchViewer,
  visibleBranches,
} from "@/lib/user-branches";
import { useAuthStore } from "@/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** "All branches" as a Select value — Radix cannot hold an empty string. */
export const ALL_BRANCHES = "all";

interface BranchFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function BranchFilter({ value, onChange }: BranchFilterProps) {
  const { branches } = useBranches();
  // Without `branches:view_all` the API answers 403 to a `branch_id` outside
  // the caller's branches, so only theirs are offered, and "all" means all of
  // theirs. `items` and the rendered options read the same viewer.
  const caller = useAuthStore((s) => s.user);
  const viewAll = useAuthStore((s) => s.hasPermission("branches:view_all"));
  const viewer = branchViewer(caller, viewAll);
  const shown = visibleBranches(branches, viewer);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Branch</Label>
      {/* This Select hands back `string | null`; there is no null option here. */}
      <Select
        value={value}
        onValueChange={(v) => onChange(v ?? ALL_BRANCHES)}
        items={branchFilterItems(branches, ALL_BRANCHES, viewer)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_BRANCHES}>{allBranchesLabel(viewer)}</SelectItem>
          {shown.map((branch) => (
            <SelectItem key={branch.id} value={String(branch.id)}>
              {branch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface DateFilterProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function DateFilter({ label, value, onChange }: DateFilterProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-[170px]"
      />
    </div>
  );
}

/** `branch_id` for a query — `undefined` rather than 0 when unfiltered. */
export function branchParam(value: string): number | undefined {
  return value === ALL_BRANCHES ? undefined : Number(value);
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
      {children}
    </div>
  );
}
