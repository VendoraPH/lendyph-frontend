"use client";

import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { StaffPicker } from "@/components/common/staff-picker";
import { usePermission } from "@/hooks/use-permission";
import type { StaffMember } from "@/types";
import { useLoanProducts } from "../../../loans/reminders/_hooks/use-loan-products";

/** The page filters as chosen: the product by id, and the people by name so the pickers keep showing them. */
export interface PageFilterChoice {
  productId?: number;
  officer: StaffMember | null;
  collector: StaffMember | null;
}

export const NO_PAGE_FILTERS: PageFilterChoice = { officer: null, collector: null };

/** The ids every endpoint gets. */
export function pageFilterIds(choice: PageFilterChoice) {
  return {
    ...(choice.productId !== undefined ? { product_id: choice.productId } : {}),
    ...(choice.officer ? { officer_id: choice.officer.id } : {}),
    ...(choice.collector ? { collector_id: choice.collector.id } : {}),
  };
}

/**
 * Product, loan officer and collector. Each is sent to every endpoint; a figure
 * that doesn't follow one says so beside it. The collector is the user who
 * recorded the payment.
 */
export function PageFilters({ value, onChange }: { value: PageFilterChoice; onChange: (next: PageFilterChoice) => void }) {
  const { can } = usePermission();
  const mayListProducts = can("loans:view");

  return (
    <>
      {mayListProducts ? <ProductFilter value={value} onChange={onChange} /> : null}
      <div className="w-[200px] space-y-1.5">
        <Label htmlFor="exec-officer" className="text-xs text-muted-foreground">
          Loan officer
        </Label>
        <StaffPicker
          id="exec-officer"
          value={value.officer}
          onChange={(officer) => onChange({ ...value, officer })}
          placeholder="All loan officers"
          clearable
        />
      </div>
      <div className="w-[200px] space-y-1.5">
        <Label htmlFor="exec-collector" className="text-xs text-muted-foreground">
          Collector
        </Label>
        <StaffPicker
          id="exec-collector"
          value={value.collector}
          onChange={(collector) => onChange({ ...value, collector })}
          placeholder="All collectors"
          clearable
        />
      </div>
    </>
  );
}

function ProductFilter({ value, onChange }: { value: PageFilterChoice; onChange: (next: PageFilterChoice) => void }) {
  const { products, error } = useLoanProducts();
  return (
    <div className="space-y-1.5">
      <Label htmlFor="exec-product" className="text-xs text-muted-foreground">
        Loan product
      </Label>
      <NativeSelect
        id="exec-product"
        className="w-[180px]"
        disabled={error !== null}
        title={error ?? undefined}
        value={value.productId ?? ""}
        onChange={(e) => onChange({ ...value, productId: e.target.value ? Number(e.target.value) : undefined })}
      >
        <NativeSelectOption value="">{error ? "Products unavailable" : "All products"}</NativeSelectOption>
        {products.map((p) => (
          <NativeSelectOption key={p.id} value={p.id}>
            {p.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
