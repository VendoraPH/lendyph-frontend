"use client";

import { useCallback } from "react";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatCurrency, formatDate, formatRate } from "@/lib/format";
import { humanize, TONE_CLASS } from "@/lib/portal/labels";
import { portalService } from "@/services/portal.service";
import { DownloadButton } from "../../../_components/download-button";
import { StatusPill } from "../../../_components/portal-shell";

/** The member's time deposits, each with its certificate. */
export function TimeDepositsCard() {
  const fetcher = useCallback(() => portalService.timeDeposits(), []);
  const resource = useApiResource(fetcher);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Time deposits</CardTitle>
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          endpoints={["GET /portal/time-deposits"]}
          summary="Your time deposits, rates and maturity dates."
          isEmpty={(rows) => rows.length === 0}
          emptyMessage="You have no time deposits."
        >
          {(rows) => (
            <ul className="divide-y">
              {rows.map((td) => (
                <li key={td.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 text-sm">
                  <div className="min-w-40 flex-1">
                    <p className="font-medium">{formatCurrency(td.principal)}</p>
                    <p className="text-xs text-muted-foreground">
                      {td.certificate_number} · {formatRate(td.interest_rate)}% for {td.term_days} days
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Matures</p>
                    <p>
                      {formatDate(td.maturity_date)} · {formatCurrency(td.maturity_value)}
                    </p>
                  </div>
                  <StatusPill className={TONE_CLASS[td.status === "active" ? "success" : "muted"]}>
                    {humanize(td.status)}
                  </StatusPill>
                  <DownloadButton
                    variant="ghost"
                    label="Certificate"
                    filename={`time-deposit-${td.certificate_number}.pdf`}
                    fetchFile={() => portalService.timeDepositCertificate(td.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}
