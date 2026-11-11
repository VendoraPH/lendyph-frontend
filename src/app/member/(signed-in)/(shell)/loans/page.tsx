"use client";

import { useCallback } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LoadState } from "@/components/portal/load-state";
import { Money } from "@/components/portal/money";
import { PortalPageHeader } from "@/components/portal/page-header";
import { StatusPill } from "@/components/portal/status-pill";
import { formatDate } from "@/lib/format";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { LOAN_STATUS, LOAN_STATUS_TONE, NONE } from "@/lib/portal/labels";
import { portalService } from "@/lib/portal/portal-api";
import type { LoanRow } from "@/lib/portal/types";
import { penaltyMonthsText } from "@/lib/portal/words";

/** The member's own released loans (never a co-maker's or a draft), as the server lists them. */
export default function LoansPage() {
  const fetcher = useCallback(() => portalService.loans(), []);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load your loans. Please try again.");

  return (
    <>
      <PortalPageHeader title="Loans" description="Outstanding is everything still owed: principal, interest, penalty and any insurance premium." />
      <LoadState loading={loading} error={error} onRetry={reload} empty={data?.length === 0} emptyText="You have no released loans.">
        <ul className="grid gap-3 md:grid-cols-2">
          {data?.map((loan) => (
            <li key={loan.id}>
              <LoanCard loan={loan} />
            </li>
          ))}
        </ul>
      </LoadState>
    </>
  );
}

function LoanCard({ loan }: { loan: LoanRow }) {
  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/member/loans/${loan.id}`} className="font-semibold break-words hover:underline">
              {loan.loan_account_number}
            </Link>
            <p className="text-xs text-muted-foreground">{loan.product_name ?? NONE}</p>
          </div>
          <StatusPill value={loan.display_status} labels={LOAN_STATUS} tones={LOAN_STATUS_TONE} />
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Outstanding</dt>
            <dd className="font-semibold">
              <Money value={loan.total_outstanding} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Principal Balance</dt>
            <dd>
              <Money value={loan.outstanding_principal} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Past Due</dt>
            <dd>
              <Money value={loan.overdue_amount} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Next due</dt>
            <dd>
              {loan.next_due_date ? (
                <>
                  <Money value={loan.next_due_amount} /> <span className="text-xs text-muted-foreground">on {formatDate(loan.next_due_date)}</span>
                </>
              ) : (
                NONE
              )}
            </dd>
          </div>
        </dl>
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Principal paid</span>
            <span>{loan.paid_percent}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Principal paid"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={loan.paid_percent}
          >
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${loan.paid_percent}%` }} />
          </div>
        </div>
        {penaltyMonthsText(loan.penalty_months) && <p className="text-xs text-destructive">{penaltyMonthsText(loan.penalty_months)}</p>}
        <Link href={`/member/loans/${loan.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Details, schedule and payments
          <span className="sr-only"> for {loan.loan_account_number}</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}
