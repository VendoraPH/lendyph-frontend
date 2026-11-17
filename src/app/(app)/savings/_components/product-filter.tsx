"use client";

import { useCallback, useId } from "react";
import { Label } from "@/components/ui/label";
import { useApiResource } from "@/hooks/use-api-resource";
import { savingsService } from "@/services";
import type { SavingsProduct, SavingsProductKind } from "@/types";
import { productFilterOptions } from "../_lib/product-filter";
import { OptionSelect } from "./option-select";

interface ProductFilterProps {
  /** `ALL_PRODUCTS` or a product id as text; send it with `productIdParam`. */
  value: string;
  /** The choice and its words ("All products", "Regular Savings"), for a report's subtitle. */
  onChange: (value: string, label: string) => void;
  /** Only this kind's products. */
  kind?: SavingsProductKind;
  className?: string;
}

/**
 * The savings product filter for the dashboard and the savings reports. Its
 * list needs `savings:view`, which every screen that shows it already
 * requires. While the list loads, or if it can't be read, only "All products"
 * is offered.
 */
export function ProductFilter({ value, onChange, kind, className }: ProductFilterProps) {
  const id = useId();
  const fetcher = useCallback(() => savingsService.products(), []);
  const products = useApiResource<SavingsProduct[]>(fetcher);
  const options = productFilterOptions(products.data, kind);

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        Product
      </Label>
      <OptionSelect
        id={id}
        value={value}
        onChange={(next) => onChange(next, options.find((o) => o.value === next)?.label ?? "")}
        options={options}
        className={className ?? "h-9 w-56"}
      />
    </div>
  );
}
