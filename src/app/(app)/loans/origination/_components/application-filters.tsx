"use client";

import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useBranches, usePermission } from "@/hooks";
import { branchPicker } from "@/lib/user-branches";
import { useAuthStore } from "@/store";
import type { ApplicationListFilters } from "@/types/loan-origination";
import { SearchInput } from "./search-input";
import { useLoanProducts } from "../../reminders/_hooks/use-loan-products";

const idOrUndefined = (v: string) => (v ? Number(v) : undefined);

/**
 * The filters `GET /loan-origination/applications` takes: search, the start
 * date range, branch, product and the officer. The server's `meta.stats`
 * counts every one of them but the status.
 */
export function ApplicationFilters({
  value,
  onChange,
}: {
  value: ApplicationListFilters;
  onChange: (next: ApplicationListFilters) => void;
}) {
  const { branches } = useBranches();
  const caller = useAuthStore((s) => s.user);
  const viewAll = useAuthStore((s) => s.hasPermission("branches:view_all"));
  const picker = branchPicker(branches, caller, viewAll);
  const { products, error: productsError } = useLoanProducts();
  // The server matches a mobile number only for borrowers:view holders.
  const searchesMobile = usePermission().can("borrowers:view");
  const set = (patch: Partial<ApplicationListFilters>) => onChange({ ...value, ...patch, page: 1 });

  return (
    <div className="grid shrink-0 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      <SearchInput
        className="sm:col-span-2 sm:w-full"
        value={value.search}
        placeholder={searchesMobile ? "Name, reference or mobile, then Enter" : "Name or reference, then Enter"}
        onChange={(search) => set({ search })}
      />
      <Input
        type="date"
        aria-label="Started from"
        title="Started from"
        value={value.date_from ?? ""}
        onChange={(e) => set({ date_from: e.target.value || undefined })}
      />
      <Input
        type="date"
        aria-label="Started to"
        title="Started to"
        value={value.date_to ?? ""}
        onChange={(e) => set({ date_to: e.target.value || undefined })}
      />
      <NativeSelect
        aria-label="Branch"
        className="w-full"
        value={value.branch_id ?? ""}
        onChange={(e) => set({ branch_id: idOrUndefined(e.target.value) })}
      >
        <NativeSelectOption value="">{picker.allLabel}</NativeSelectOption>
        {picker.branches.map((b) => (
          <NativeSelectOption key={b.id} value={b.id}>
            {b.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Loan product"
        className="w-full"
        disabled={productsError !== null}
        title={productsError ?? undefined}
        value={value.loan_product_id ?? ""}
        onChange={(e) => set({ loan_product_id: idOrUndefined(e.target.value) })}
      >
        <NativeSelectOption value="">{productsError ? "Products unavailable" : "All products"}</NativeSelectOption>
        {products.map((p) => (
          <NativeSelectOption key={p.id} value={p.id}>
            {p.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Officer"
        className="w-full"
        value={value.assigned ?? ""}
        onChange={(e) => set({ assigned: (e.target.value || undefined) as ApplicationListFilters["assigned"] })}
      >
        <NativeSelectOption value="">Any officer</NativeSelectOption>
        <NativeSelectOption value="me">Assigned to me</NativeSelectOption>
        <NativeSelectOption value="none">Not assigned</NativeSelectOption>
      </NativeSelect>
    </div>
  );
}
