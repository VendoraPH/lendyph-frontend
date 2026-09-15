"use client";

import { useBranches } from "@/hooks";
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

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Branch</Label>
      <Select value={value} onValueChange={(v) => onChange(v ?? ALL_BRANCHES)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_BRANCHES}>All branches</SelectItem>
          {branches.map((branch) => (
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
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Risk Level</Label>
      <Select value={value} onValueChange={(v) => onChange(v ?? ALL_RISK_LEVELS)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_RISK_LEVELS}>All risk levels</SelectItem>
          {(Object.keys(RISK_LEVEL_LABELS) as RiskLevel[]).map((level) => (
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
