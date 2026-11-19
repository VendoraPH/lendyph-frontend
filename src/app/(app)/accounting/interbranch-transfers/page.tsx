"use client";

import { useCallback, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { PermissionGate, RouteGuard, TablePagination } from "@/components/common";
import { FillSection, PageFill, ScrollBox } from "@/components/common/page-fill";
import { BranchCountsCards } from "@/components/branches/branch-counts-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermission } from "@/hooks";
import { useApiResource } from "@/hooks/use-api-resource";
import { FIT_CLASSES } from "@/lib/page-fill";
import { interbranchTransferService } from "@/services";
import type { InterbranchTransfer, InterbranchTransferStatus } from "@/types/interbranch-transfer";
import { AccountingPageHeader } from "../_components/page-header";
import { DataState } from "../_components/data-state";
import { InTransitReport } from "./_components/in-transit-report";
import { TransferActionDialog } from "./_components/transfer-action-dialog";
import { TransferFormDialog } from "./_components/transfer-form-dialog";
import { TransfersTable } from "./_components/transfers-table";
import {
  sendBackForm,
  stepRefreshes,
  type TransferActionButton,
  type TransferForm,
  type TransferStep,
} from "./_lib/transfers";
import { VISIBLE_SCROLLBAR } from "./_lib/table-scroll";

const PER_PAGE = 25;

const STATUS_FILTERS: { value: "all" | InterbranchTransferStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending_approval", label: "Pending approval" },
  { value: "in_transit", label: "In transit" },
  { value: "received", label: "Received" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "reversed", label: "Reversed" },
];

function InterbranchTransfersContent() {
  const { can } = usePermission();
  const canCreate = can("interbranch_transfers:create");
  const [tab, setTab] = useState<"transfers" | "in-transit">("transfers");
  const [status, setStatus] = useState<"all" | InterbranchTransferStatus>("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ open: boolean; initial: TransferForm | null }>({ open: false, initial: null });
  const [pending, setPending] = useState<{ transfer: InterbranchTransfer; action: TransferActionButton } | null>(null);
  const [countsKey, setCountsKey] = useState(0);

  const listFetcher = useCallback(
    () =>
      interbranchTransferService.list({
        page,
        per_page: PER_PAGE,
        ...(status === "all" ? {} : { status }),
      }),
    [page, status],
  );
  const list = useApiResource(listFetcher);
  const reportFetcher = useCallback(() => interbranchTransferService.inTransit(), []);
  const report = useApiResource(reportFetcher, tab === "in-transit");

  const afterStep = (step: TransferStep) => {
    const reload = stepRefreshes(step);
    if (reload.list) list.refetch();
    if (reload.inTransit && tab === "in-transit") report.refetch();
    if (reload.counts) setCountsKey((k) => k + 1);
  };
  const onAction = (transfer: InterbranchTransfer, action: TransferActionButton) => setPending({ transfer, action });
  const onSendBack = (transfer: InterbranchTransfer) => setForm({ open: true, initial: sendBackForm(transfer) });

  return (
    <PageFill className="fit:gap-4">
      <AccountingPageHeader
        title="Interbranch Transfers"
        description="Money moved from one branch to another through Interbranch Clearing (1190)."
        actions={
          <PermissionGate permission="interbranch_transfers:create">
            <Button onClick={() => setForm({ open: true, initial: null })}>
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              New transfer
            </Button>
          </PermissionGate>
        }
      />

      <BranchCountsCards refreshKey={countsKey} />

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value === "in-transit" ? "in-transit" : "transfers")}
        className={FIT_CLASSES.section}
      >
        {/* The tabs and the list's filter share one line, so the list keeps its height. */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="transfers">Transfers</TabsTrigger>
            <TabsTrigger value="in-transit">In transit</TabsTrigger>
          </TabsList>
          {tab === "transfers" && (
            <Select
              value={status}
              onValueChange={(next: string | null) => {
                setStatus((STATUS_FILTERS.find((f) => f.value === next)?.value ?? "all"));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48" aria-label="Status">
                <SelectValue>{(value: string) => STATUS_FILTERS.find((f) => f.value === value)?.label ?? "All statuses"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value="transfers" className={FIT_CLASSES.section}>
          <DataState
            resource={list}
            summary="Transfers between your branches, newest first."
            endpoints={["GET /interbranch-transfers"]}
            isEmpty={(data) => (data.data ?? []).length === 0}
            emptyMessage="No interbranch transfer matches."
          >
            {(data) => (
              <FillSection>
                <Card className={FIT_CLASSES.section}>
                  <CardContent className={FIT_CLASSES.section}>
                    <ScrollBox className={VISIBLE_SCROLLBAR} tabIndex={0} role="region" aria-label="Transfers, scrolls sideways">
                      <TransfersTable rows={data.data} canCreate={canCreate} onAction={onAction} onSendBack={onSendBack} />
                    </ScrollBox>
                    <TablePagination
                      page={page}
                      perPage={PER_PAGE}
                      total={data.meta.total}
                      perPageOptions={[PER_PAGE]}
                      onPageChange={setPage}
                      onPerPageChange={() => setPage(1)}
                    />
                  </CardContent>
                </Card>
              </FillSection>
            )}
          </DataState>
        </TabsContent>

        <TabsContent value="in-transit" className={FIT_CLASSES.section}>
          <DataState
            resource={report}
            summary="Transfers in transit and each branch's interbranch position."
            endpoints={["GET /interbranch-transfers/in-transit"]}
          >
            {(data) => <InTransitReport report={data} canCreate={canCreate} onAction={onAction} onSendBack={onSendBack} />}
          </DataState>
        </TabsContent>
      </Tabs>

      <TransferFormDialog
        open={form.open}
        initial={form.initial}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        onCreated={() => afterStep("create")}
      />
      <TransferActionDialog pending={pending} onClose={() => setPending(null)} onDone={afterStep} />
    </PageFill>
  );
}

export default function InterbranchTransfersPage() {
  return (
    <RouteGuard permission="interbranch_transfers:view" pageName="Interbranch Transfers">
      <InterbranchTransfersContent />
    </RouteGuard>
  );
}
