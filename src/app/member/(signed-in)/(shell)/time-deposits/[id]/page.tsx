"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { DetailList } from "@/components/portal/detail-list";
import { DownloadButton } from "@/components/portal/download-button";
import { LoadState } from "@/components/portal/load-state";
import { Money } from "@/components/portal/money";
import { PortalPageHeader } from "@/components/portal/page-header";
import { SectionCard } from "@/components/portal/section-card";
import { StatusPill } from "@/components/portal/status-pill";
import { formatDate } from "@/lib/format";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { MATURITY_INSTRUCTION, NONE, TIME_DEPOSIT_STATUS, TIME_DEPOSIT_STATUS_TONE, labelOf } from "@/lib/portal/labels";
import { featureOn } from "@/lib/portal/nav";
import { portalService } from "@/lib/portal/portal-api";
import { usePortalSession } from "@/lib/portal/portal-session";
import { plural, rateText } from "@/lib/portal/words";

/** One time deposit: the server's placement figures and its certificate PDF. */
export default function TimeDepositPage() {
  const { id } = useParams<{ id: string }>();
  const depositId = Number(id);
  const features = usePortalSession((s) => s.features);
  const fetcher = useCallback(() => portalService.timeDeposit(depositId), [depositId]);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load this time deposit. Please try again.");

  return (
    <>
      <Link href="/member/savings#time-deposits" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Savings
      </Link>
      <LoadState loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <PortalPageHeader
              title={data.certificate_number}
              description={
                <span className="inline-flex flex-wrap items-center gap-2">
                  {data.product_name}
                  <StatusPill value={data.status} labels={TIME_DEPOSIT_STATUS} tones={TIME_DEPOSIT_STATUS_TONE} />
                </span>
              }
              actions={
                featureOn(features, "statements") ? (
                  <DownloadButton download={() => portalService.timeDepositCertificate(depositId)} fileName={`time-deposit-${data.certificate_number}.pdf`}>
                    Certificate (PDF)
                  </DownloadButton>
                ) : undefined
              }
            />
            <SectionCard title="Placement">
              <DetailList
                items={[
                  { label: "Amount placed", value: <Money value={data.principal} />, strong: true },
                  { label: "Amount at maturity", value: <Money value={data.maturity_amount} />, strong: true },
                  { label: "Interest rate", value: `${rateText(data.annual_rate)} a year` },
                  { label: "Term", value: plural(data.term_days, "day") },
                  { label: "Placed on", value: formatDate(data.placement_date) },
                  { label: "Matures on", value: formatDate(data.maturity_date) },
                  { label: "Days left", value: data.days_remaining === null ? NONE : plural(data.days_remaining, "day") },
                  { label: "Gross interest", value: <Money value={data.gross_interest} /> },
                  { label: "Withholding tax", value: <Money value={data.withholding_tax} /> },
                  { label: "Net interest", value: <Money value={data.net_interest} /> },
                  { label: "At maturity", value: labelOf(MATURITY_INSTRUCTION, data.maturity_instruction) },
                ]}
              />
              {data.maturing_soon && <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">This time deposit matures within 30 days.</p>}
            </SectionCard>
          </>
        )}
      </LoadState>
    </>
  );
}
