"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSavingsProducts } from "../_hooks/use-savings-products";

/** "All products" as a Select value: a Select cannot hold an empty string. */
export const ALL_PRODUCTS = "all";

/**
 * Savings product select for a list's or run's `savings_product_id`. Hidden
 * when the viewer may not read products (see `useSavingsProducts`).
 */
export function ProductFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const products = useSavingsProducts();
  if (!products.allowed) return null;
  const rows = products.data?.rows ?? [];
  const items = [{ value: ALL_PRODUCTS, label: "All products" }, ...rows.map((p) => ({ value: String(p.id), label: p.name }))];
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Product</Label>
      <Select value={value} onValueChange={(v) => onChange(v ?? ALL_PRODUCTS)} items={items}>
        <SelectTrigger className="w-[180px]">
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
