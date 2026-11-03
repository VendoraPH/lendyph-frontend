"use client";

import { useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useApiResource } from "@/hooks";
import { RouteGuard } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";
import { savingsInterestService } from "@/services/savings-interest.service";
import type { InterestBatchDetail } from "@/types/savings";
import { ToneBadge } from "../../_components/tone-badge";
import { BATCH_STATUS_LABEL, BATCH_STATUS_TONE } from "../../_lib/interest-batch";
import { InterestRows, InterestTotals } from "../_components/interest-rows";
import { BatchActions } from "./_components/batch-actions";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

function BatchDetail({ batch, onChanged }: { batch: InterestBatchDetail; onChanged: () => void }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Interest batch ${batch.reference_number}`}
        description={`${formatDate(batch.period_from)} to ${formatDate(batch.period_to)}`}
        actions={
          <>
            <ToneBadge tone={BATCH_STATUS_TONE[batch.status]}>{BATCH_STATUS_LABEL[batch.status]}</ToneBadge>
            <BatchActions batch={batch} onChanged={onChanged} />
          </>
        }
      />
      <Card>
        <CardContent className="pt-6">
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Product">{batch.product?.name ?? "All products"}</Field>
            <Field label="Branch">{batch.branch?.name ?? "All branches"}</Field>
            <Field label="Created">
              {batch.created_by?.name ?? "—"} · {formatDateTime(batch.created_at)}
            </Field>
            <Field label="Approved by">{batch.approved_by?.name ?? "—"}</Field>
            <Field label="Posted">
              {batch.posted_at ? `${batch.posted_by?.name ?? "—"} · ${formatDateTime(batch.posted_at)}` : "—"}
            </Field>
            {batch.reversed_by && <Field label="Reversed by">{batch.reversed_by.name}</Field>}
            {batch.reversal_reason && (
              <div className="sm:col-span-2">
                <Field label="Reason">{batch.reversal_reason}</Field>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>
      <InterestTotals totals={batch.totals} />
      <InterestRows rows={batch.rows} />
    </div>
  );
}

function BatchContent({ id }: { id: number }) {
  const fetcher = useCallback(() => savingsInterestService.getBatch(id), [id]);
  const resource = useApiResource(fetcher);
  return (
    <div className="min-w-0 space-y-6">
      <Link href="/savings/interest" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Savings interest
      </Link>
      <DataState
        resource={resource}
        summary="One interest batch: its period, scope, per-account figures and approval state."
        endpoints={["GET /savings/interest/batches/{id}"]}
      >
        {(batch) => <BatchDetail batch={batch} onChanged={resource.refetch} />}
      </DataState>
    </div>
  );
}

export default function SavingsInterestBatchPage() {
  const { batchId } = useParams<{ batchId: string }>();
  // Approvers review batches without needing to run them.
  return (
    <RouteGuard permission={["savings:post", "savings:approve"]} pageName="Interest Batch">
      <BatchContent key={batchId} id={Number(batchId)} />
    </RouteGuard>
  );
}
