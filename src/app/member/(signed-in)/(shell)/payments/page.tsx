"use client";

import { useCallback, useState } from "react";
import { LoadState } from "@/components/portal/load-state";
import { PortalPageHeader } from "@/components/portal/page-header";
import { Pager } from "@/components/portal/pager";
import { PaymentsList } from "@/components/portal/payments-list";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { portalService } from "@/lib/portal/portal-api";

/** Every posted payment on the member's loans, newest first. */
export default function PaymentsPage() {
  const [page, setPage] = useState(1);
  const fetcher = useCallback(() => portalService.payments(page), [page]);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load your payments. Please try again.");

  return (
    <>
      <PortalPageHeader title="Payments" description="Payments received on your loans. Pay at your branch as usual." />
      <LoadState loading={loading} error={error} onRetry={reload} empty={data?.data.length === 0} emptyText="No payments yet.">
        {data && (
          <>
            <PaymentsList payments={data.data} showLoan />
            <Pager meta={data.meta} onPage={setPage} />
          </>
        )}
      </LoadState>
    </>
  );
}
