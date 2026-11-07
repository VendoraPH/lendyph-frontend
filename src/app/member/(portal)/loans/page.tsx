"use client";

import { useCallback } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatCurrency, formatDate } from "@/lib/format";
import { LOAN_STATUS, toAmount } from "@/lib/portal/finance";
import { TONE_CLASS } from "@/lib/portal/labels";
import { portalService } from "@/services/portal.service";
import type { PortalLoanSummary } from "@/types/portal";
import { usePortalConfig } from "../../_components/portal-config";
import { PortalPageHeader, StatusPill } from "../../_components/portal-shell";
import { ServiceOff } from "../../_components/service-off";
import { ApplicationsCard } from "./_components/applications-card";

export default function MemberLoansPage() {
  const { config } = usePortalConfig();
  const enabled = config.features.loans;
  const fetcher = useCallback(() => portalService.loans(), []);
  const resource = useApiResource(fetcher, enabled);
  const canApply = enabled && config.features.loan_applications;

  return (
    <>
      <PortalPageHeader
        title="My loans"
        description="Your current and past loans with the cooperative."
        actions={
          canApply && (
            <Button size="sm" render={<Link href="/member/loans/apply" />}>
              <Plus className="mr-1.5 h-4 w-4" /> Apply for a loan
            </Button>
          )
        }
      />
      {canApply && (
        <div className="mb-5">
          <ApplicationsCard />
        </div>
      )}
      {!enabled ? (
        <ServiceOff service="Loan information" />
      ) : (
        <DataState
          resource={resource}
          endpoints={["GET /portal/loans"]}
          summary="Your loans, balances and next due dates will show here once online access is connected."
          isEmpty={(rows) => rows.length === 0}
          emptyMessage="You have no loans with the cooperative."
        >
          {(rows) => (
            <div className="space-y-3">
              {rows.map((loan) => (
                <LoanCard key={loan.id} loan={loan} />
              ))}
            </div>
          )}
        </DataState>
      )}
    </>
  );
}

function LoanCard({ loan }: { loan: PortalLoanSummary }) {
  const status = LOAN_STATUS[loan.status] ?? { label: loan.status, tone: "muted" as const };
  const pastDue = toAmount(loan.past_due_amount);
  return (
    <Link href={`/member/loans/${loan.id}`} className="block">
      <Card className="transition-colors hover:bg-muted/40">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{loan.product_name}</span>
              <StatusPill className={TONE_CLASS[status.tone]}>{status.label}</StatusPill>
            </div>
            <p className="text-xs text-muted-foreground">
              {loan.loan_number}
              {loan.released_at && ` · Released ${formatDate(loan.released_at)}`}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 pt-1 text-sm">
              <span>
                Balance <span className="font-semibold">{formatCurrency(loan.outstanding_balance)}</span>
              </span>
              {loan.next_due_date && (
                <span>
                  Next due {formatDate(loan.next_due_date)}
                  {loan.next_due_amount != null && ` · ${formatCurrency(loan.next_due_amount)}`}
                </span>
              )}
              {pastDue > 0 && <span className="text-destructive">Past due {formatCurrency(pastDue)}</span>}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        </CardContent>
      </Card>
    </Link>
  );
}
