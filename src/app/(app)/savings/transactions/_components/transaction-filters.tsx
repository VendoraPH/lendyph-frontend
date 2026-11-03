"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { BranchFilter } from "@/components/common/branch-filter";
import { DateRangeFilter } from "@/components/common/date-range-filter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SavingsTransactionStatus, SavingsTransactionType } from "@/types/savings";
import { TRANSACTION_STATUS_LABEL, TRANSACTION_TYPE_LABEL } from "../../_lib/account-status";

const ALL = "all";

export interface TransactionFilterValues {
  search: string;
  type: typeof ALL | SavingsTransactionType;
  status: typeof ALL | SavingsTransactionStatus;
  branchId: string;
  from: string | null;
  to: string | null;
}

export const EMPTY_TRANSACTION_FILTERS: TransactionFilterValues = {
  search: "",
  type: ALL,
  status: ALL,
  branchId: ALL,
  from: null,
  to: null,
};

/** The filters as `GET /savings/transactions` params; "all" and blanks are left out. */
export function transactionFilterParams(f: TransactionFilterValues): Record<string, unknown> {
  return {
    ...(f.search ? { search: f.search } : {}),
    ...(f.type !== ALL ? { type: f.type } : {}),
    ...(f.status !== ALL ? { status: f.status } : {}),
    ...(f.branchId !== ALL ? { branch_id: Number(f.branchId) } : {}),
    ...(f.from ? { date_from: f.from } : {}),
    ...(f.to ? { date_to: f.to } : {}),
  };
}

function CodeSelect<T extends string>({
  label,
  allLabel,
  labels,
  value,
  onChange,
}: {
  label: string;
  allLabel: string;
  labels: Record<T, string>;
  value: T | typeof ALL;
  onChange: (v: T | typeof ALL) => void;
}) {
  const items = [
    { value: ALL, label: allLabel },
    ...(Object.entries(labels) as [T, string][]).map(([v, l]) => ({ value: v, label: l })),
  ];
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select<string> value={value} onValueChange={(v) => onChange((v ?? ALL) as T | typeof ALL)} items={items}>
        <SelectTrigger className="w-[170px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Search on Enter (reference, account number or member), type, status, branch and date. */
export function TransactionFilters({
  value,
  onChange,
}: {
  value: TransactionFilterValues;
  onChange: (next: TransactionFilterValues) => void;
}) {
  const [term, setTerm] = useState(value.search);
  const set = (patch: Partial<TransactionFilterValues>) => onChange({ ...value, ...patch });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <form
        role="search"
        className="relative w-full sm:w-72"
        onSubmit={(e) => {
          e.preventDefault();
          set({ search: term.trim() });
        }}
      >
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search savings transactions"
          placeholder="Reference, account or member, press Enter"
          className="pl-8"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            if (e.target.value === "") set({ search: "" });
          }}
        />
      </form>
      <CodeSelect
        label="Type"
        allLabel="All types"
        labels={TRANSACTION_TYPE_LABEL}
        value={value.type}
        onChange={(type) => set({ type })}
      />
      <CodeSelect
        label="Status"
        allLabel="All statuses"
        labels={TRANSACTION_STATUS_LABEL}
        value={value.status}
        onChange={(status) => set({ status })}
      />
      <BranchFilter value={value.branchId} onChange={(branchId) => set({ branchId })} />
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Transaction date</Label>
        <DateRangeFilter from={value.from} to={value.to} onChange={(from, to) => set({ from, to })} />
      </div>
    </div>
  );
}
