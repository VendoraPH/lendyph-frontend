"use client";

import { useCallback, useState } from "react";
import { LoadState } from "@/components/portal/load-state";
import { Pager } from "@/components/portal/pager";
import { PaymentsList } from "@/components/portal/payments-list";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { portalService } from "@/lib/portal/portal-api";

/** The loan's posted payments, newest first, a page at a time. */
export function LoanPayments({ loanId }: { loanId: number }) {
  const [page, setPage] = useState(1);
  const fetcher = useCallback(() => portalService.loanPayments(loanId, page), [loanId, page]);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load the payments. Please try again.");

  return (
    <LoadState loading={loading} error={error} onRetry={reload} empty={data?.data.length === 0} emptyText="No payments yet.">
      {data && (
        <>
          <PaymentsList payments={data.data} />
          <Pager meta={data.meta} onPage={setPage} />
        </>
      )}
    </LoadState>
  );
}
