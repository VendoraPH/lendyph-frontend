import type { SavingsProduct, SavingsProductKind } from "@/types";
import { PRODUCT_KIND_LABELS, labelOf } from "./savings-rules";

/** The Select value for "every product"; a Select can't hold null. */
export const ALL_PRODUCTS = "all";

export interface ProductFilterOption {
  value: string;
  label: string;
}

/**
 * A product filter's choices: "All products", then the products by name,
 * active ones first. With `kind`, only that kind's products (a time deposit
 * report lists time deposit products). Without it, each says its kind, since
 * a regular and a time deposit product can share a name.
 */
export function productFilterOptions(
  products: readonly Pick<SavingsProduct, "id" | "name" | "kind" | "is_active">[] | null | undefined,
  kind?: SavingsProductKind,
): ProductFilterOption[] {
  const listed = (products ?? [])
    .filter((p) => !kind || p.kind === kind)
    .slice()
    .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name));
  return [
    { value: ALL_PRODUCTS, label: "All products" },
    ...listed.map((p) => ({
      value: String(p.id),
      label:
        (kind ? p.name : `${p.name} (${labelOf(PRODUCT_KIND_LABELS, p.kind)})`) +
        (p.is_active ? "" : " · off"),
    })),
  ];
}

/** `product_id` for a request: a positive id, or undefined for every product. */
export function productIdParam(value: string): number | undefined {
  const id = Number(value);
  return value !== ALL_PRODUCTS && Number.isInteger(id) && id > 0 ? id : undefined;
}
