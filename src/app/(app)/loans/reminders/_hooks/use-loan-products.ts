import { useEffect, useState } from "react";
import { completeRows } from "@/lib/paginate";
import { loanProductService } from "@/services/loan-product.service";
import type { LoanProduct } from "@/types";

/**
 * Loan products for the reminder filters and rule scope. Fails soft to an
 * empty list, like `useBranches`: the picker then offers only "All products",
 * which is what a rule without a product means anyway.
 */
export function useLoanProducts(): LoanProduct[] {
  const [products, setProducts] = useState<LoanProduct[]>([]);

  useEffect(() => {
    let cancelled = false;
    loanProductService
      .listAll()
      .then(completeRows)
      .then((rows) => {
        if (!cancelled) setProducts(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return products;
}
