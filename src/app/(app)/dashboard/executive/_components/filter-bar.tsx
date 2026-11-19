"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangeFilter } from "@/components/common/date-range-filter";
import type { BranchSelectItem } from "@/lib/user-branches";
import type { ExecutivePreset } from "@/types/executive-dashboard";
import { EXECUTIVE_PRESETS } from "../../_lib/executive-overview";

const PRESET_ITEMS = EXECUTIVE_PRESETS.map((p) => ({ value: p.id, label: p.label }));

/**
 * The dashboard's period, branch, refresh and export controls. A preset's
 * dates are the server's (shown once it answers); picking dates makes the
 * period a custom range. The branch
 * options come from the page, which also needs the picked branch's name for
 * the export letterhead, so the branch list loads once.
 */
export function FilterBar({
  preset,
  onPreset,
  from,
  to,
  onRange,
  branch,
  branchItems,
  onBranch,
  onRefresh,
  refreshing,
  exportSlot,
  filtersSlot,
}: {
  preset: ExecutivePreset;
  onPreset: (preset: ExecutivePreset) => void;
  from: string;
  to: string;
  onRange: (from: string | null, to: string | null) => void;
  branch: string;
  branchItems: BranchSelectItem[];
  onBranch: (value: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  exportSlot: React.ReactNode;
  /** The product, officer and collector filters. */
  filtersSlot?: React.ReactNode;
}) {
  return (
    // One row where it fits: each label sits beside its control, and the
    // product, officer and collector filters sit behind "More filters".
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <Label htmlFor="exec-period" className="text-xs text-muted-foreground">
          Period
        </Label>
        <Select value={preset} onValueChange={(v) => v && onPreset(v as ExecutivePreset)} items={PRESET_ITEMS}>
          <SelectTrigger id="exec-period" className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESET_ITEMS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DateRangeFilter label="Dates" from={from} to={to} onChange={onRange} />

      <div className="flex items-center gap-2">
        <Label htmlFor="exec-branch" className="text-xs text-muted-foreground">
          Branch
        </Label>
        <Select value={branch} onValueChange={(v) => v && onBranch(v)} items={branchItems}>
          <SelectTrigger id="exec-branch" className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {branchItems.map((b) => (
              <SelectItem key={b.value} value={b.value}>
                {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtersSlot}

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
          Refresh
        </Button>
        {exportSlot}
      </div>
    </div>
  );
}
