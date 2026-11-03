"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { DateRangeFilter } from "@/components/common/date-range-filter";
import { BranchFilter } from "@/components/common/branch-filter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SavingsAccountStatus } from "@/types/savings";
import { ACCOUNT_STATUS_LABEL } from "../../_lib/account-status";
import { ProductFilter } from "../../_components/product-filter";

export type AccountStatusFilter = "all" | SavingsAccountStatus;
export const ALL = "all";

export interface AccountFilterValues {
  status: AccountStatusFilter;
  search: string;
  productId: string;
  branchId: string;
  openedFrom: string | null;
  openedTo: string | null;
}

export const EMPTY_ACCOUNT_FILTERS: AccountFilterValues = {
  status: ALL,
  search: "",
  productId: ALL,
  branchId: ALL,
  openedFrom: null,
  openedTo: null,
};

/** The filters as list params; "all" and blanks are left out. */
export function accountFilterParams(f: AccountFilterValues): Record<string, unknown> {
  return {
    ...(f.status !== ALL ? { status: f.status } : {}),
    ...(f.search ? { search: f.search } : {}),
    ...(f.productId !== ALL ? { savings_product_id: Number(f.productId) } : {}),
    ...(f.branchId !== ALL ? { branch_id: Number(f.branchId) } : {}),
    ...(f.openedFrom ? { opened_from: f.openedFrom } : {}),
    ...(f.openedTo ? { opened_to: f.openedTo } : {}),
  };
}

const STATUSES = Object.keys(ACCOUNT_STATUS_LABEL) as SavingsAccountStatus[];

interface AccountFiltersProps {
  value: AccountFilterValues;
  onChange: (next: AccountFilterValues) => void;
  /** `meta.stats` from the server: global per-status counts. */
  stats?: Record<string, number>;
}

/** Status tabs (counts from the server), search on Enter, product, branch and date opened. */
export function AccountFilters({ value, onChange, stats }: AccountFiltersProps) {
  const [term, setTerm] = useState(value.search);
  const set = (patch: Partial<AccountFilterValues>) => onChange({ ...value, ...patch });
  const count = (key: string) => (stats && key in stats ? ` (${stats[key]})` : "");
  const total = stats?.total;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={value.status} onValueChange={(v) => set({ status: v as AccountStatusFilter })}>
          <TabsList className="flex-wrap">
            <TabsTrigger value={ALL}>All{total === undefined ? "" : ` (${total})`}</TabsTrigger>
            {STATUSES.map((s) => (
              <TabsTrigger key={s} value={s}>
                {ACCOUNT_STATUS_LABEL[s]}
                {count(s)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <form
          role="search"
          className="relative w-full lg:w-80"
          onSubmit={(e) => {
            e.preventDefault();
            set({ search: term.trim() });
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search savings accounts"
            placeholder="Account number or member, press Enter"
            className="pl-8"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              if (e.target.value === "") set({ search: "" });
            }}
          />
        </form>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <ProductFilter value={value.productId} onChange={(productId) => set({ productId })} />
        <BranchFilter value={value.branchId} onChange={(branchId) => set({ branchId })} />
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Date opened</Label>
          <DateRangeFilter
            from={value.openedFrom}
            to={value.openedTo}
            onChange={(openedFrom, openedTo) => set({ openedFrom, openedTo })}
          />
        </div>
      </div>
    </div>
  );
}
