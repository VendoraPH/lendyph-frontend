"use client";

import { useCallback, useId } from "react";
import { useApiResource, useBranches, usePermission } from "@/hooks";
import { loanProductService } from "@/services";
import { completeRows } from "@/lib/paginate";
import { MEMBER_TYPE_LABELS, SCORE_TREND_LABELS } from "@/lib/credit-scoring/labels";
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
import type { MemberType, RiskLevel, ScoreTrend } from "@/types/credit-scoring";
import type { LoanProduct } from "@/types/loan";

/** "All branches"/"All risk levels" as a Select value — cannot hold an empty string. */
export const ALL_BRANCHES = "all";
export const ALL_RISK_LEVELS = "all";
/** The unfiltered value of every other list filter. */
export const ALL_OPTIONS = "all";

interface FilterItem {
  value: string;
  label: string;
}

/**
 * A labelled dropdown filter. `items` starts with its "All …" entry, and the
 * trigger always reads an item's label, never its value.
 */
export function SelectFilter({
  label,
  value,
  items,
  onChange,
  disabled = false,
  hint,
}: {
  label: string;
  value: string;
  items: FilterItem[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** A short line under the dropdown (a load that failed). */
  hint?: string | null;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v ?? items[0].value)} items={items} disabled={disabled}>
        <SelectTrigger id={id} className="w-[180px]" aria-describedby={hint ? hintId : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

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

  return <SelectFilter label="Risk Level" value={value} items={items} onChange={onChange} />;
}

interface OptionFilterProps {
  value: string;
  onChange: (value: string) => void;
}

const TRENDS = Object.keys(SCORE_TREND_LABELS) as ScoreTrend[];

export function TrendFilter({ value, onChange }: OptionFilterProps) {
  const items = [
    { value: ALL_OPTIONS, label: "All trends" },
    ...TRENDS.map((trend) => ({ value: trend, label: SCORE_TREND_LABELS[trend] })),
  ];
  return <SelectFilter label="Trend" value={value} items={items} onChange={onChange} />;
}

const MEMBER_TYPES = Object.keys(MEMBER_TYPE_LABELS) as MemberType[];

export function MemberTypeFilter({ value, onChange }: OptionFilterProps) {
  const items = [
    { value: ALL_OPTIONS, label: "All member types" },
    ...MEMBER_TYPES.map((type) => ({ value: type, label: MEMBER_TYPE_LABELS[type] })),
  ];
  return <SelectFilter label="Member Type" value={value} items={items} onChange={onChange} />;
}

/**
 * Members with a loan of one product. Products are a loans:view read, so they
 * are asked for only with it (the page shows this filter only then, too).
 */
export function LoanProductFilter({ value, onChange }: OptionFilterProps) {
  const { can } = usePermission();
  const canViewLoans = can("loans:view");
  const fetcher = useCallback(async () => completeRows(await loanProductService.listAll()), []);
  const products = useApiResource<LoanProduct[]>(fetcher, canViewLoans);
  const items = [
    { value: ALL_OPTIONS, label: "All loan products" },
    ...(products.data ?? []).map((p) => ({ value: String(p.id), label: p.name })),
  ];
  const hint = products.loading ? "Loading products…" : products.error ? "Products couldn't load." : null;
  return (
    <SelectFilter
      label="Loan Product"
      value={value}
      items={items}
      onChange={onChange}
      disabled={!products.data}
      hint={hint}
    />
  );
}

/** A list filter's value for a query — `undefined` when unfiltered. */
export function optionParam<T extends string>(value: string): T | undefined {
  return value === ALL_OPTIONS ? undefined : (value as T);
}

/** `loan_product_id` for a query — `undefined` when unfiltered. */
export function loanProductParam(value: string): number | undefined {
  return value === ALL_OPTIONS ? undefined : Number(value);
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
