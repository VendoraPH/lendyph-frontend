import { useCallback } from "react";
import { useApiResource, usePermission } from "@/hooks";
import { emptyDrain } from "@/lib/paginate";
import { savingsProductService } from "@/services/savings-product.service";
import type { SavingsProduct, SavingsProductStatus } from "@/types/savings";

/**
 * Every savings product (drained past the 100-row clamp), for pickers and
 * filters. `status` narrows it, e.g. "active" for opening an account.
 *
 * The read needs `savings:view` or `savings_products:manage`; without either
 * it is skipped and `allowed` is false, so callers can say why it is empty.
 */
export function useSavingsProducts(status?: SavingsProductStatus) {
  const { can } = usePermission();
  const allowed = can("savings:view") || can("savings_products:manage");
  const fetcher = useCallback(
    () =>
      allowed
        ? savingsProductService.listAll(status ? { status } : {})
        : Promise.resolve(emptyDrain<SavingsProduct>()),
    [allowed, status],
  );
  return { ...useApiResource(fetcher), allowed };
}
