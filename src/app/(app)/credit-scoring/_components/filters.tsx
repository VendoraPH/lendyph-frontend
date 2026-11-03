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
import { RISK_LEVEL_LABELS } from "@/constants/risk-level";
import type { RiskLevel } from "@/types/credit-scoring";

/** "All branches"/"All risk levels" as a Select value — cannot hold an empty string. */
export const ALL_BRANCHES = "all";
export const ALL_RISK_LEVELS = "all";

interface BranchFilterProps {
  value: string;
  onChange: (value: string) => void;
}

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

interface RiskLevelFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function RiskLevelFilter({ value, onChange }: RiskLevelFilterProps) {
  const riskLevels = Object.keys(RISK_LEVEL_LABELS) as RiskLevel[];
  const items = [
    { value: ALL_RISK_LEVELS, label: "All risk levels" },
    ...riskLevels.map((level) => ({ value: level, label: RISK_LEVEL_LABELS[level] })),
  ];

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Risk Level</Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v ?? ALL_RISK_LEVELS)}
        items={items}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_RISK_LEVELS}>All risk levels</SelectItem>
          {riskLevels.map((level) => (
            <SelectItem key={level} value={level}>
              {RISK_LEVEL_LABELS[level]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** `branch_id` for a query — `undefined` rather than 0 when unfiltered. */
export function branchParam(value: string): number | undefined {
  return value === ALL_BRANCHES ? undefined : Number(value);
}

/** `risk_level` for a query — `undefined` when unfiltered. */
export function riskLevelParam(value: string): RiskLevel | undefined {
  return value === ALL_RISK_LEVELS ? undefined : (value as RiskLevel);
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
      {children}
    </div>
  );
}
