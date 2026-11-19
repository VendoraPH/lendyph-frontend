/**
 * The dashboard's page filters (product, loan officer, collector): what the
 * user picked, the ids every endpoint gets, and the chips that show them.
 * Pure, so the count and the chips are unit-tested.
 */

import type { StaffMember } from "@/types";
import type { ExecutiveFilters } from "@/types/executive-dashboard";

/** The page filters as chosen: the product by id, and the people by name so the pickers keep showing them. */
export interface PageFilterChoice {
  productId?: number;
  officer: StaffMember | null;
  collector: StaffMember | null;
}

export const NO_PAGE_FILTERS: PageFilterChoice = { officer: null, collector: null };

export type PageFilterKey = "product" | "officer" | "collector";

/** The ids every endpoint gets. */
export function pageFilterIds(choice: PageFilterChoice): ExecutiveFilters {
  return {
    ...(choice.productId !== undefined ? { product_id: choice.productId } : {}),
    ...(choice.officer ? { officer_id: choice.officer.id } : {}),
    ...(choice.collector ? { collector_id: choice.collector.id } : {}),
  };
}

/** The active filters as removable chips, in words; their number is the "More filters" count. */
export function activeFilterChips(
  choice: PageFilterChoice,
  products: readonly { id: number; name: string }[],
): { key: PageFilterKey; label: string }[] {
  const chips: { key: PageFilterKey; label: string }[] = [];
  if (choice.productId !== undefined) {
    const name = products.find((p) => p.id === choice.productId)?.name ?? `#${choice.productId}`;
    chips.push({ key: "product", label: `Product: ${name}` });
  }
  if (choice.officer) chips.push({ key: "officer", label: `Loan officer: ${choice.officer.full_name}` });
  if (choice.collector) chips.push({ key: "collector", label: `Collector: ${choice.collector.full_name}` });
  return chips;
}

/** The choice with one filter cleared. */
export function withoutFilter(choice: PageFilterChoice, key: PageFilterKey): PageFilterChoice {
  if (key === "product") return { ...choice, productId: undefined };
  return { ...choice, [key]: null };
}
