"use client";

import { useCallback, useState } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { PermissionGate, RouteGuard } from "@/components/common";
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
import { sendBackForm, type TransferActionButton, type TransferForm } from "./_lib/transfers";

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

  const refresh = () => {
    list.refetch();
    if (tab === "in-transit") report.refetch();
  };
  const onAction = (transfer: InterbranchTransfer, action: TransferActionButton) => setPending({ transfer, action });
  const onSendBack = (transfer: InterbranchTransfer) => setForm({ open: true, initial: sendBackForm(transfer) });

  const lastPage = list.data?.meta?.last_page ?? 1;

  return (
    <PageFill>
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

      <BranchCountsCards />

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value === "in-transit" ? "in-transit" : "transfers")}
        className={FIT_CLASSES.section}
      >
        <TabsList className="shrink-0">
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="in-transit">In transit</TabsTrigger>
        </TabsList>

        <TabsContent value="transfers" className={FIT_CLASSES.section}>
          <div className="flex shrink-0 items-center gap-2">
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
          </div>
          <DataState
            resource={list}
            summary="Transfers between your branches, newest first."
            endpoints={["GET /interbranch-transfers"]}
            isEmpty={(data) => (data.data ?? []).length === 0}
            emptyMessage="No interbranch transfer matches."
          >
            {(data) => (
              <FillSection className="gap-3">
                <Card className={FIT_CLASSES.section}>
                  <CardContent className={FIT_CLASSES.section}>
                    <ScrollBox>
                      <TransfersTable rows={data.data} canCreate={canCreate} onAction={onAction} onSendBack={onSendBack} />
                    </ScrollBox>
                  </CardContent>
                </Card>
                <div className="flex shrink-0 items-center justify-end gap-2 text-sm text-muted-foreground">
                  <span>
                    Page {data.meta.current_page} of {lastPage} ({data.meta.total})
                  </span>
                  <Button variant="outline" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" aria-label="Next page" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
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
        onCreated={refresh}
      />
      <TransferActionDialog pending={pending} onClose={() => setPending(null)} onDone={refresh} />
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
