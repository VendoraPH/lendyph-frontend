"use client";

import { useCallback, useState } from "react";
import { TablePagination } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { useApiResource } from "@/hooks/use-api-resource";
import { portalService } from "@/services/portal.service";
import { PaymentsTable } from "../../_components/payments-table";
import { usePortalConfig } from "../../_components/portal-config";
import { PortalPageHeader } from "../../_components/portal-shell";
import { ServiceOff } from "../../_components/service-off";

/** Every payment posted to the member's loans, paged on the server. */
export default function MemberPaymentsPage() {
  const { config } = usePortalConfig();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const fetcher = useCallback(() => portalService.payments({ page, per_page: perPage }), [page, perPage]);
  const resource = useApiResource(fetcher, config.features.loans);

  return (
    <>
      <PortalPageHeader title="Payments" description="Payments the cooperative has posted to your loans." />
      {!config.features.loans ? (
        <ServiceOff service="Payment history" />
      ) : (
        <DataState
          resource={resource}
          endpoints={["GET /portal/payments"]}
          summary="Your payment history and official receipts will show here once online access is connected."
        >
          {(body) => (
            <div className="space-y-3">
              <PaymentsTable payments={body.data} />
              <TablePagination
                page={page}
                perPage={perPage}
                total={body.meta?.total ?? body.data.length}
                onPageChange={setPage}
                onPerPageChange={(n) => {
                  setPerPage(n);
                  setPage(1);
                }}
              />
            </div>
          )}
        </DataState>
      )}
    </>
  );
}
