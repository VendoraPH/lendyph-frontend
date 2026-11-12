"use client";

import { BranchFilter } from "@/components/common/branch-filter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ProductFilter } from "../../_components/product-filter";
import { DASHBOARD_PRESETS, type DashboardPeriod, type DashboardPreset } from "../_lib/dashboard-period";

interface DashboardFiltersProps {
  preset: DashboardPreset;
  onPreset: (preset: DashboardPreset) => void;
  period: DashboardPeriod;
  onCustom: (period: DashboardPeriod) => void;
  branch: string;
  onBranch: (value: string) => void;
  product: string;
  onProduct: (value: string) => void;
}

/** Period (Today to This Year, or Custom), branch and product. */
export function DashboardFilters({
  preset,
  onPreset,
  period,
  onCustom,
  branch,
  onBranch,
  product,
  onProduct,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
      <fieldset className="space-y-1.5">
        <legend className="text-xs text-muted-foreground">Period</legend>
        <div className="flex flex-wrap gap-1.5">
          {DASHBOARD_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={preset === p.id}
              onClick={() => onPreset(p.id)}
              className={cn(
                "h-9 rounded-md border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                preset === p.id
                  ? "border-brand-orange bg-brand-orange text-brand-orange-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="savings-dashboard-from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="savings-dashboard-from"
          type="date"
          value={period.from}
          onChange={(e) => onCustom({ ...period, from: e.target.value })}
          className="h-9 w-40"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="savings-dashboard-to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="savings-dashboard-to"
          type="date"
          value={period.to}
          onChange={(e) => onCustom({ ...period, to: e.target.value })}
          className="h-9 w-40"
        />
      </div>
      <BranchFilter value={branch} onChange={onBranch} className="h-9 w-48" />
      <ProductFilter value={product} onChange={(value) => onProduct(value)} />
    </div>
  );
}
