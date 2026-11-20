"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { StaffPicker } from "@/components/common/staff-picker";
import { usePermission } from "@/hooks/use-permission";
import { useLoanProducts } from "../../../loans/reminders/_hooks/use-loan-products";
import { activeFilterChips, withoutFilter, type PageFilterChoice } from "../../_lib/page-filters";

export { NO_PAGE_FILTERS, pageFilterIds, type PageFilterChoice } from "../../_lib/page-filters";

type Props = { value: PageFilterChoice; onChange: (next: PageFilterChoice) => void };

/**
 * Product, loan officer and collector, behind one "More filters" button that
 * counts the active ones, so the filter bar stays one row. Each active filter
 * shows as a removable chip beside it. Every filter is sent to every endpoint;
 * a figure that doesn't follow one says so. The collector is the user who
 * recorded the payment.
 */
export function PageFilters({ value, onChange }: Props) {
  const { can } = usePermission();
  const mayListProducts = can("loans:view");
  // Products load only for a user who may list them; the chip then names the product.
  const { products } = useLoanProducts(mayListProducts);
  const chips = activeFilterChips(value, products);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger render={<Button variant="outline" size="sm" className="h-8" />}>
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          More filters
          {chips.length > 0 ? (
            <span className="rounded-full bg-brand-orange px-1.5 text-xs font-medium text-brand-orange-foreground">
              {chips.length}
              <span className="sr-only"> active</span>
            </span>
          ) : null}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-3">
          <PopoverHeader>
            <PopoverTitle>More filters</PopoverTitle>
            <PopoverDescription>Every figure that follows a filter is narrowed by it; the others say so.</PopoverDescription>
          </PopoverHeader>
          {mayListProducts ? <ProductFilter value={value} onChange={onChange} products={products} /> : null}
          <div className="space-y-1.5">
            <Label htmlFor="exec-officer" className="text-xs text-muted-foreground">
              Loan officer
            </Label>
            <StaffPicker
              id="exec-officer"
              value={value.officer}
              onChange={(officer) => onChange({ ...value, officer })}
              placeholder="All loan officers"
              clearLabel="Clear loan officer"
              clearable
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exec-collector" className="text-xs text-muted-foreground">
              Collector
            </Label>
            <StaffPicker
              id="exec-collector"
              value={value.collector}
              onChange={(collector) => onChange({ ...value, collector })}
              placeholder="All collectors"
              clearLabel="Clear collector"
              clearable
            />
          </div>
        </PopoverContent>
      </Popover>
      {chips.map((chip) => (
        <span key={chip.key} className="inline-flex h-7 items-center gap-1 rounded-full border bg-muted/50 pl-2.5 pr-1 text-xs">
          {chip.label}
          <button
            type="button"
            aria-label={`Remove filter: ${chip.label}`}
            onClick={() => onChange(withoutFilter(value, chip.key))}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </span>
      ))}
    </div>
  );
}

function ProductFilter({ value, onChange, products }: Props & { products: { id: number; name: string }[] }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="exec-product" className="text-xs text-muted-foreground">
        Loan product
      </Label>
      <NativeSelect
        id="exec-product"
        className="w-full"
        value={value.productId ?? ""}
        onChange={(e) => onChange({ ...value, productId: e.target.value ? Number(e.target.value) : undefined })}
      >
        <NativeSelectOption value="">All products</NativeSelectOption>
        {products.map((p) => (
          <NativeSelectOption key={p.id} value={p.id}>
            {p.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
