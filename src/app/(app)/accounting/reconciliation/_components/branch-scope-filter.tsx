"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BranchSelectItem } from "@/lib/user-branches";
import { ANY_BRANCH } from "../_lib/branch-scope";

interface BranchScopeFilterProps {
  /** `reconciliationFilterItems()`. */
  items: BranchSelectItem[];
  value: string;
  onChange: (value: string) => void;
}

/** The list's branch filter: one branch, the "All branches" reconciliations (view_all), or every one. */
export function BranchScopeFilter({ items, value, onChange }: BranchScopeFilterProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        Branch
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v ?? ANY_BRANCH)} items={items}>
        <SelectTrigger id={id} className="w-[200px]">
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
    </div>
  );
}
