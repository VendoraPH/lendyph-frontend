"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Smartphone } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiResource } from "@/hooks/use-api-resource";
import { todayISO } from "@/lib/format";
import { isPayable } from "@/lib/portal/finance";
import { portalService } from "@/services/portal.service";
import type { PortalLoanDetail } from "@/types/portal";
import { notifyInfo } from "@/lib/notify";
import { DownloadButton } from "../../../_components/download-button";
import { NewRequestDialog } from "../../../_components/new-request-dialog";
import { PaymentsTable } from "../../../_components/payments-table";
import { usePortalConfig } from "../../../_components/portal-config";
import { ServiceOff } from "../../../_components/service-off";
import { GCashPayDialog } from "../_components/gcash-pay-dialog";
import { CollateralList } from "../_components/collateral-list";
import { LoanSummaryCard } from "../_components/loan-summary-card";
import { ScheduleTable } from "../_components/schedule-table";

export default function MemberLoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const loanId = Number(id);
  const { config } = usePortalConfig();
  const fetcher = useCallback(() => portalService.loan(loanId), [loanId]);
  const resource = useApiResource(fetcher, config.features.loans && Number.isInteger(loanId));

  return (
    <>
      <Link
        href="/member/loans"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> My loans
      </Link>
      {!config.features.loans ? (
        <ServiceOff service="Loan information" />
      ) : (
        <DataState
          resource={resource}
          endpoints={["GET /portal/loans/{id}"]}
          summary="This loan's balance, schedule and payments will show here once online access is connected."
        >
          {(loan) => <LoanDetail loan={loan} />}
        </DataState>
      )}
    </>
  );
}

function LoanDetail({ loan }: { loan: PortalLoanDetail }) {
  const { config } = usePortalConfig();
  const [paying, setPaying] = useState(false);
  const fetchSchedule = useCallback(() => portalService.loanSchedule(loan.id), [loan.id]);
  const schedule = useApiResource(fetchSchedule);
  const fetchPayments = useCallback(() => portalService.loanPayments(loan.id), [loan.id]);
  const payments = useApiResource(fetchPayments);
  const canPay = config.features.gcash_payments && isPayable(loan.status);
  const [restructuring, setRestructuring] = useState(false);
  const canRestructure = isPayable(loan.status);

  const actions = (
    <>
      {config.features.statements && (
        <DownloadButton
          label="Statement of account"
          filename={`soa-${loan.loan_number}-${todayISO()}.pdf`}
          fetchFile={() => portalService.loanStatement(loan.id)}
        />
      )}
      {canPay && (
        <Button size="sm" onClick={() => setPaying(true)}>
          <Smartphone className="mr-1.5 h-4 w-4" /> Pay with GCash
        </Button>
      )}
      {canRestructure && (
        <Button size="sm" variant="outline" onClick={() => setRestructuring(true)}>
          Request restructuring
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-5">
      <LoanSummaryCard loan={loan} actions={actions} />
      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="collateral">Collateral</TabsTrigger>
        </TabsList>
        <TabsContent value="schedule" className="pt-3">
          <DataState
            resource={schedule}
            endpoints={["GET /portal/loans/{id}/schedule"]}
            summary="Each installment, its due date and what has been paid."
          >
            {(rows) => <ScheduleTable rows={rows} />}
          </DataState>
        </TabsContent>
        <TabsContent value="payments" className="pt-3">
          <DataState
            resource={payments}
            endpoints={["GET /portal/loans/{id}/payments"]}
            summary="Payments posted to this loan, with official receipts."
          >
            {(rows) => <PaymentsTable payments={rows} showLoan={false} />}
          </DataState>
        </TabsContent>
        <TabsContent value="collateral" className="pt-3">
          <CollateralList collaterals={loan.collaterals ?? []} loanNumber={loan.loan_number} />
        </TabsContent>
      </Tabs>
      {canPay && <GCashPayDialog open={paying} onOpenChange={setPaying} loan={loan} />}
      {canRestructure && (
        <NewRequestDialog
          open={restructuring}
          onOpenChange={setRestructuring}
          initialType="loan_restructure"
          initialValues={{ loan_id: String(loan.id) }}
          onSubmitted={() => notifyInfo("You can follow it under Requests.")}
        />
      )}
    </div>
  );
}
