import { emptyDrain, type DrainResult } from "@/lib/paginate";
import type { LoanProduct } from "@/types";

/**
 * Fees are scoped to loan products, and listing those needs `loans:view`
 * (GET /loan-products). Without it the list isn't asked for: an empty one
 * stands in (`emptyDrain()`), so the fees still show, with no error.
 */
export function feeProductsRead(
  canListProducts: boolean,
  listAll: () => Promise<DrainResult<LoanProduct>>,
): Promise<DrainResult<LoanProduct>> {
  return canListProducts ? listAll() : Promise.resolve(emptyDrain<LoanProduct>());
}

/**
 * A fee's Products cell: "All products" when it names none, else its products
 * by name (two, then "+N"). `names` is null when the products list wasn't
 * read (no `loans:view`): a scoped fee then gives its count, in words.
 */
export function feeProductsText(
  productIds: readonly number[] | undefined,
  names: ReadonlyMap<number, string> | null,
): string {
  const ids = productIds ?? [];
  if (ids.length === 0) return "All products";
  if (names === null) return `${ids.length} ${ids.length === 1 ? "product" : "products"} (names need loan access)`;
  // An id the list didn't hold keeps its place: dropped, a fee scoped to one
  // product would read "All products", a false statement about what members
  // are charged.
  const named = ids.map((id) => names.get(id) ?? `Product #${id}`);
  return named.length <= 2 ? named.join(", ") : `${named.slice(0, 2).join(", ")} +${named.length - 2}`;
}
