"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { DetailList } from "@/components/portal/detail-list";
import { LoadState } from "@/components/portal/load-state";
import { Money } from "@/components/portal/money";
import { PortalPageHeader } from "@/components/portal/page-header";
import { SectionCard } from "@/components/portal/section-card";
import { StatusPill } from "@/components/portal/status-pill";
import { formatDate } from "@/lib/format";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { NONE, SAVINGS_STATUS, SAVINGS_STATUS_TONE } from "@/lib/portal/labels";
import { featureOn } from "@/lib/portal/nav";
import { portalService } from "@/lib/portal/portal-api";
import { usePortalSession } from "@/lib/portal/portal-session";
import { rateText } from "@/lib/portal/words";
import { Passbook } from "./_components/passbook";
import { SavingsStatement } from "./_components/savings-statement";

const date = (value: string | null) => (value ? formatDate(value) : NONE);

/** One savings account: the server's balances, the passbook and the statement PDF. */
export default function SavingsAccountPage() {
  const { id } = useParams<{ id: string }>();
  const accountId = Number(id);
  const features = usePortalSession((s) => s.features);
  const fetcher = useCallback(() => portalService.savingsAccount(accountId), [accountId]);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load this account. Please try again.");

  return (
    <>
      <Link href="/member/savings" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Savings
      </Link>
      <LoadState loading={loading} error={error} onRetry={reload}>
        {data && (
          <div className="space-y-4">
            <PortalPageHeader
              title={data.account_number}
              description={
                <span className="inline-flex flex-wrap items-center gap-2">
                  {data.product_name}
                  <StatusPill value={data.status} labels={SAVINGS_STATUS} tones={SAVINGS_STATUS_TONE} />
                </span>
              }
            />
            {(data.status === "dormant" || data.status === "frozen") && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Withdrawals from this account are done at your branch. Please visit your branch.
              </p>
            )}
            <SectionCard title="Balances">
              <DetailList
                items={[
                  { label: "Balance", value: <Money value={data.ledger_balance} />, strong: true },
                  { label: "Can withdraw now", value: <Money value={data.withdrawable} />, strong: true },
                  { label: "Available balance", value: <Money value={data.available_balance} /> },
                  { label: "Pending withdrawal", value: <Money value={data.pending_withdrawal} /> },
                  { label: "On hold", value: <Money value={data.held} /> },
                  { label: "Maintaining balance", value: <Money value={data.maintaining_balance} /> },
                  { label: "Interest earned, not yet credited", value: <Money value={data.accrued_interest} /> },
                  { label: "Interest credited up to", value: date(data.interest_credited_through) },
                  { label: "Interest rate", value: `${rateText(data.annual_rate)} a year` },
                  { label: "Opened on", value: date(data.opened_on) },
                  { label: "Branch", value: data.branch_name ?? NONE },
                  { label: "Last transaction", value: date(data.last_transaction_on) },
                ]}
              />
            </SectionCard>
            {featureOn(features, "statements") && <SavingsStatement accountId={accountId} accountNumber={data.account_number} />}
            <Passbook accountId={accountId} />
          </div>
        )}
      </LoadState>
    </>
  );
}
