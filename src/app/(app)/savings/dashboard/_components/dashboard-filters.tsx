"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AlignedBranchFilter } from "../../_components/aligned-branch-filter";
import { AlignedProductFilter } from "../../_components/aligned-product-filter";
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
    // One row from xl: the presets and dates keep their size, and the branch and product pickers share the rest.
    <div className="flex shrink-0 flex-wrap items-end gap-3 rounded-lg border bg-card p-3 xl:flex-nowrap">
      <fieldset className="shrink-0 space-y-1.5">
        <legend className="text-xs text-muted-foreground">Period</legend>
        <div className="flex flex-wrap gap-1.5">
          {DASHBOARD_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={preset === p.id}
              onClick={() => onPreset(p.id)}
              className={cn(
                "h-8 rounded-md border px-2.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
      <div className="flex shrink-0 flex-col gap-1.5">
        <Label htmlFor="savings-dashboard-from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="savings-dashboard-from"
          type="date"
          value={period.from}
          onChange={(e) => onCustom({ ...period, from: e.target.value })}
          className="w-36"
        />
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        <Label htmlFor="savings-dashboard-to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="savings-dashboard-to"
          type="date"
          value={period.to}
          onChange={(e) => onCustom({ ...period, to: e.target.value })}
          className="w-36"
        />
      </div>
      <AlignedBranchFilter
        value={branch}
        onChange={onBranch}
        className="w-full"
        wrapperClassName="w-48 xl:w-auto xl:max-w-56 xl:min-w-36 xl:flex-1"
      />
      <AlignedProductFilter
        value={product}
        onChange={(value) => onProduct(value)}
        className="w-full"
        wrapperClassName="w-56 xl:w-auto xl:max-w-64 xl:min-w-36 xl:flex-1"
      />
    </div>
  );
}
