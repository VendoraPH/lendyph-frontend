import { useEffect, useState } from "react";
import { completeRows } from "@/lib/paginate";
import { loanProductService } from "@/services/loan-product.service";
import type { LoanProduct } from "@/types";

/**
 * Loan products for the reminder filters and rule scope.
 *
 * A failed or incomplete load comes back as `error`, not as a quietly empty
 * list: an empty picker reads as "this organization has no products", and on
 * the rule form it would hide which product a rule is scoped to. Callers show
 * the message and keep "All products" working.
 */
export function useLoanProducts(): { products: LoanProduct[]; error: string | null } {
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Loads once per mount, so the initial state above already reads "no
  // error" — there is nothing to reset before the request goes out.
  useEffect(() => {
    let cancelled = false;
    loanProductService
      .listAll()
      .then(completeRows)
      .then((rows) => {
        if (!cancelled) setProducts(rows);
      })
      .catch(() => {
        if (!cancelled) setError("Loan products couldn't be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { products, error };
}
