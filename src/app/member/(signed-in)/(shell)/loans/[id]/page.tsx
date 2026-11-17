"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { DownloadButton } from "@/components/portal/download-button";
import { LoadState } from "@/components/portal/load-state";
import { PortalPageHeader } from "@/components/portal/page-header";
import { StatusPill } from "@/components/portal/status-pill";
import { FIT_CLASSES } from "@/lib/page-fill";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { LOAN_STATUS, LOAN_STATUS_TONE } from "@/lib/portal/labels";
import { featureOn } from "@/lib/portal/nav";
import { portalService } from "@/lib/portal/portal-api";
import { usePortalSession } from "@/lib/portal/portal-session";
import { LoanSummary } from "./_components/loan-summary";
import { LoanPayments } from "./_components/loan-payments";
import { LoanSchedule } from "./_components/loan-schedule";

/**
 * One loan: the server's summary, its schedule and payments, and the Statement
 * of Account PDF. At the `fit:` size the heading and tabs stay put and the
 * open tab scrolls inside its box.
 */
export default function LoanPage() {
  const { id } = useParams<{ id: string }>();
  const loanId = Number(id);
  const features = usePortalSession((s) => s.features);
  const fetcher = useCallback(() => portalService.loan(loanId), [loanId]);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load this loan. Please try again.");

  return (
    <PageFill className="gap-4">
      <Link href="/member/loans" className="inline-flex shrink-0 items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Loans
      </Link>
      <LoadState loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <PortalPageHeader
              title={data.loan_account_number}
              description={
                <span className="inline-flex flex-wrap items-center gap-2">
                  {data.product_name}
                  <StatusPill value={data.display_status} labels={LOAN_STATUS} tones={LOAN_STATUS_TONE} />
                </span>
              }
              actions={
                featureOn(features, "statements") ? (
                  <DownloadButton download={() => portalService.loanStatement(loanId)} fileName={`statement-of-account-${data.loan_account_number}.pdf`}>
                    Statement of Account (PDF)
                  </DownloadButton>
                ) : undefined
              }
            />
            <Tabs defaultValue="summary" className={FIT_CLASSES.section}>
              <TabsList className="w-full shrink-0 sm:w-fit">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
                <TabsTrigger value="payments">Payments</TabsTrigger>
              </TabsList>
              <TabsContent value="summary" className={FIT_CLASSES.section}>
                <ScrollBox className="p-px">
                  <LoanSummary loan={data} />
                </ScrollBox>
              </TabsContent>
              <TabsContent value="schedule" className={FIT_CLASSES.section}>
                <LoanSchedule loanId={loanId} />
              </TabsContent>
              <TabsContent value="payments" className={FIT_CLASSES.section}>
                <LoanPayments loanId={loanId} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </LoadState>
    </PageFill>
  );
}
