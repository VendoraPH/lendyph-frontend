"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useChartOfAccounts, usePermission } from "@/hooks";
import { cn } from "@/lib/utils";
import { AccountingPageHeader } from "../../_components/page-header";
import { BranchAccessNotice } from "../_components/branch-access-notice";
import { ReasonButton } from "../_components/reason-button";
import { ResolveLineDialog } from "../_components/resolve-line-dialog";
import { useWorksheet } from "../_components/use-worksheet";
import { useWorksheetActions } from "../_components/use-worksheet-actions";
import { WorksheetHeader } from "../_components/worksheet-header";
import { WorksheetTable } from "../_components/worksheet-table";

const LIST_HREF = "/accounting/reconciliation";
const NO_SUGGESTION_REASON = "There are no possible matches to accept.";

function BackLink() {
  return (
    <Link href={LIST_HREF} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
      <ArrowLeft className="mr-1 size-4" />
      All reconciliations
    </Link>
  );
}

function WorksheetContent({ id }: { id: number }) {
  const canViewAll = usePermission().can("branches:view_all");
  const { postable, isTemplate } = useChartOfAccounts();
  const worksheet = useWorksheet(id, canViewAll);
  const actions = useWorksheetActions(id, worksheet, canViewAll);
  const reconciliation = worksheet.state?.reconciliation ?? null;
  const notice = worksheet.state?.notice ?? null;

  if (reconciliation === null) {
    return (
      <div className="space-y-6">
        <AccountingPageHeader title="Reconciliation" description="One account's statement, line by line." actions={<BackLink />} />
        {worksheet.error ? (
          <Card>
            <CardContent className="space-y-3 py-8 text-sm">
              <p className="text-muted-foreground">{worksheet.error}</p>
              <Button variant="outline" size="sm" onClick={worksheet.reload}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex justify-center py-12">
            <Spinner className="h-6 w-6" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AccountingPageHeader
        title="Reconciliation"
        description="Match each statement line to the books, or record the entry that is missing."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {worksheet.loading && <Spinner className="h-4 w-4" />}
            <BackLink />
            <ReasonButton
              size="sm"
              reason={reconciliation.possible_count > 0 ? null : NO_SUGGESTION_REASON}
              disabled={actions.busy || worksheet.loading}
              onClick={actions.acceptSuggestions}
            >
              Accept all suggestions
            </ReasonButton>
          </div>
        }
      />

      {notice && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800"
        >
          <CheckCircle2 className="size-4" />
          <span>{notice.text}</span>
          <Link href={notice.href} className="font-medium underline underline-offset-2">
            Open the journal entry
          </Link>
        </div>
      )}

      <WorksheetHeader reconciliation={reconciliation} />

      <WorksheetTable
        reconciliation={reconciliation}
        busy={actions.busy || worksheet.loading}
        onConfirm={actions.confirm}
        onUnmatch={actions.unmatch}
        onResolve={actions.setResolving}
      />

      <ResolveLineDialog
        row={actions.resolving}
        reconciliation={reconciliation}
        accounts={postable}
        chartAvailable={!isTemplate}
        onClose={() => actions.setResolving(null)}
        onMatch={actions.onMatch}
        onRecord={actions.onRecord}
      />
    </div>
  );
}

function WorksheetGate({ id }: { id: number }) {
  const canViewAll = usePermission().can("branches:view_all");

  if (!canViewAll || !Number.isInteger(id) || id < 1) {
    return (
      <div className="space-y-6">
        <AccountingPageHeader title="Reconciliation" description="One account's statement, line by line." actions={<BackLink />} />
        <BranchAccessNotice
          message={canViewAll ? "This reconciliation doesn't exist, or it was removed." : undefined}
        />
      </div>
    );
  }

  return <WorksheetContent id={id} />;
}

export default function ReconciliationWorksheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RouteGuard permission="accounting:reconcile" pageName="Reconciliation">
      <WorksheetGate id={Number(id)} />
    </RouteGuard>
  );
}
