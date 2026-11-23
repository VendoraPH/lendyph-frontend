import type { Permission } from "@/types";

/**
 * Savings set-up that applies to every branch: the settings, the tax rules on
 * deposit interest, and the products with their rates. Changing any of it
 * needs savings:settings and branches:view_all, as the backend's
 * AuthorizesCompanyWideSavings (and the product delete) require; reading it
 * stays on savings:view. One rule for every screen that changes it.
 */
export type CompanyWideSavings = "settings" | "tax_rules" | "products";

/** How each reason opens, in words. */
const WORDS: Record<CompanyWideSavings, { changing: string; applies: string }> = {
  settings: { changing: "Changing the savings settings", applies: "The savings settings apply" },
  tax_rules: { changing: "Adding a tax rule", applies: "Tax rules apply" },
  products: { changing: "Changing savings products and their rates", applies: "Savings products and their rates apply" },
};

/** The permission still missing to change company-wide savings set-up, or null. */
export function companyWideMissing(
  can: (permission: Permission) => boolean,
): "savings:settings" | "branches:view_all" | null {
  if (!can("savings:settings")) return "savings:settings";
  if (!can("branches:view_all")) return "branches:view_all";
  return null;
}

/** Why a screen that changes company-wide savings set-up is read-only, in words; null when it takes edits. */
export function companyWideBlocker(can: (permission: Permission) => boolean, what: CompanyWideSavings): string | null {
  const missing = companyWideMissing(can);
  if (missing === "savings:settings") return `${WORDS[what].changing} needs the Savings configure permission.`;
  if (missing === "branches:view_all") return `${WORDS[what].applies} to every branch, so changing them needs access to all branches.`;
  return null;
}
