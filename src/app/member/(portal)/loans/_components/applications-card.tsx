"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { TONE_CLASS, humanize } from "@/lib/portal/labels";
import { APPLICATION_STATUS, canCancel } from "@/lib/portal/requests";
import { portalService } from "@/services/portal.service";
import { StatusPill } from "../../../_components/portal-shell";
import { RequestTimeline } from "../../../_components/request-timeline";

const fetchApplications = () => portalService.loanApplications();

/** The member's loan applications and how far each has gone. */
export function ApplicationsCard() {
  const resource = useApiResource(fetchApplications);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const rows = resource.data ?? [];

  const cancel = (id: number) => {
    setCancelling(id);
    portalService
      .cancelLoanApplication(id)
      .then(() => {
        notifySuccess("Application withdrawn");
        resource.refetch();
      })
      .catch((err) => notifyError(err, "The application could not be withdrawn."))
      .finally(() => setCancelling(null));
  };

  // The loans list is what this screen is for; nothing to show means no card.
  if (resource.unavailable || resource.loading || (!resource.error && rows.length === 0)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Loan applications</CardTitle>
      </CardHeader>
      <CardContent>
        {resource.error ? (
          <p className="text-sm text-destructive">{resource.error}</p>
        ) : (
          <ul className="divide-y">
            {rows.map((a) => {
              const status = APPLICATION_STATUS[a.status] ?? { label: humanize(a.status), tone: "muted" as const };
              return (
                <li key={a.id} className="space-y-2 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.product_name}</span>
                    <StatusPill className={TONE_CLASS[status.tone]}>{status.label}</StatusPill>
                    <span className="text-xs text-muted-foreground">
                      {a.reference} · {formatDateTime(a.submitted_at)}
                    </span>
                    {canCancel(a.status) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-7"
                        disabled={cancelling === a.id}
                        onClick={() => cancel(a.id)}
                      >
                        Withdraw
                      </Button>
                    )}
                  </div>
                  <p className="text-muted-foreground">
                    {formatCurrency(a.amount)} for {a.term} {a.term_unit} · {a.purpose}
                  </p>
                  {a.response && <p className="rounded-md bg-muted p-2 text-xs">Cooperative&apos;s reply: {a.response}</p>}
                  {a.loan_id && (
                    <Link href={`/member/loans/${a.loan_id}`} className="text-xs underline">
                      View the loan
                    </Link>
                  )}
                  <RequestTimeline entries={a.timeline} labels={APPLICATION_STATUS} />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
