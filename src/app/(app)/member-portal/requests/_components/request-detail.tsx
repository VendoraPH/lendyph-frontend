"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { portalAdminService } from "@/services/portal-admin.service";
import type { PortalRequestDecision, PortalRequestDetail } from "@/types/portal-admin";
import { ActionButton } from "../../../savings/_components/action-button";
import { APPROVAL_STATUS_LABELS, HOLD_STATUS_LABELS } from "../../../savings/_lib/savings-rules";
import { usePortalResource } from "../../_hooks/use-portal-resource";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_TONES,
  REQUEST_TYPE_LABELS,
  WITHDRAWAL_METHOD_LABELS,
  labelOf,
  toneOf,
} from "../../_lib/labels";
import { DECISION_LABELS, TYPE_PERMISSION, decisionsFor } from "../../_lib/request-rules";
import { StateBadge } from "../../_components/state-badge";
import { DecisionDialog } from "./decision-dialog";
import { RequestTimeline } from "./request-timeline";

/**
 * One member request: what was asked, the savings records it touches (hold,
 * second approval, posted transaction, opened account), the timeline with
 * staff names, and the decisions its status allows. Profile values show in
 * full only with borrowers:view and payout numbers only with savings:view;
 * the server masks them otherwise. Adapted from #513 by Augustin.
 */
export function RequestDetail({ id }: { id: number }) {
  const fetcher = useCallback(() => portalAdminService.request(id), [id]);
  const resource = usePortalResource(fetcher);
  const [deciding, setDeciding] = useState<PortalRequestDecision | null>(null);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" nativeButton={false} render={<Link href="/member-portal/requests" />}>
        <ArrowLeft className="h-4 w-4" aria-hidden /> Portal Requests
      </Button>
      <DataState resource={resource} endpoints={[]} summary="This member request.">
        {(r) => (
          <>
            <Header request={r} onDecide={setDeciding} />
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <Details request={r} />
                <SavingsRecords request={r} />
              </div>
              <RequestTimeline events={r.timeline} />
            </div>
            <DecisionDialog
              request={r}
              decision={deciding}
              onOpenChange={(open) => !open && setDeciding(null)}
              onDecided={resource.refetch}
            />
          </>
        )}
      </DataState>
    </div>
  );
}

function Header({ request: r, onDecide }: { request: PortalRequestDetail; onDecide: (d: PortalRequestDecision) => void }) {
  const decisions = decisionsFor(r.status);
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{labelOf(REQUEST_TYPE_LABELS, r.type)}</h1>
        <p className="font-mono text-sm text-muted-foreground">{r.reference}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StateBadge label={labelOf(REQUEST_STATUS_LABELS, r.status)} tone={toneOf(REQUEST_STATUS_TONES, r.status)} />
          {r.member && (
            <Link href={`/borrowers/${r.member.id}`} className="hover:underline">
              {r.member.name} ({r.member.member_number})
            </Link>
          )}
          {r.branch && <span className="text-muted-foreground">{r.branch.name}</span>}
        </div>
        <p className="text-sm text-muted-foreground">{r.summary}</p>
      </div>
      {decisions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {decisions.map((d) => (
            <ActionButton
              key={d}
              permission={TYPE_PERMISSION[r.type]}
              size="sm"
              variant={d === "approve" ? "default" : d === "reject" ? "destructive" : "outline"}
              onClick={() => onDecide(d)}
            >
              {DECISION_LABELS[d]}
            </ActionButton>
          ))}
        </div>
      )}
      {r.status === "approved" && (
        <p className="max-w-sm text-sm text-muted-foreground">
          Waiting for a second approval.{" "}
          <Link href="/savings/approvals" className="underline">
            Decide it in Savings Approvals
          </Link>
          ; this request follows that decision.
        </p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children || "—"}</dd>
    </div>
  );
}

function Details({ request: r }: { request: PortalRequestDetail }) {
  const d = r.details;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">What the member asked for</CardTitle>
      </CardHeader>
      <CardContent>
        {r.type === "profile_update" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Field</th>
                  <th className="py-1.5 pr-3 font-medium">Now</th>
                  <th className="py-1.5 font-medium">Asked for</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(d.changes ?? []).map((c) => (
                  <tr key={c.field}>
                    <td className="py-1.5 pr-3">{c.label}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{c.current ?? "—"}</td>
                    <td className="py-1.5 font-medium">{c.requested ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <dl className="divide-y">
            <Row label="Amount">{r.amount === null ? null : formatCurrency(r.amount)}</Row>
            {r.type === "savings_withdrawal" ? (
              <>
                <Row label="From account">
                  {d.account_id ? (
                    <Link href={`/savings/accounts/${d.account_id}`} className="font-mono hover:underline">
                      {d.account_number}
                    </Link>
                  ) : (
                    d.account_number
                  )}
                  {d.product_name && <span className="text-muted-foreground"> · {d.product_name}</span>}
                </Row>
                <Row label="Paid out by">{d.method ? labelOf(WITHDRAWAL_METHOD_LABELS, d.method) : null}</Row>
                {d.payout?.bank_name && <Row label="Bank">{d.payout.bank_name}</Row>}
                {d.payout?.account_name && <Row label="Account name">{d.payout.account_name}</Row>}
                {d.payout?.account_number && <Row label="Account number">{d.payout.account_number}</Row>}
                {d.payout?.gcash_number && <Row label="GCash number">{d.payout.gcash_number}</Row>}
              </>
            ) : (
              <Row label="Product">{d.product_name}</Row>
            )}
            <Row label="Sent">{r.created_at ? formatDateTime(r.created_at) : null}</Row>
            <Row label="Expires">{r.expires_on ? formatDate(r.expires_on) : null}</Row>
            {r.decided_by && (
              <Row label="Decided by">
                {r.decided_by.name}
                {r.decided_at ? `, ${formatDateTime(r.decided_at)}` : ""}
              </Row>
            )}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function SavingsRecords({ request: r }: { request: PortalRequestDetail }) {
  if (!r.hold && !r.approval && !r.transaction && !r.opened_account) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">In Savings</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          {r.hold && (
            <Row label="Money held">
              {formatCurrency(r.hold.amount)} · {labelOf(HOLD_STATUS_LABELS, r.hold.status)}
              {r.hold.expires_on && r.hold.status === "active" ? `, until ${formatDate(r.hold.expires_on)}` : ""}
            </Row>
          )}
          {r.approval && (
            <Row label="Second approval">
              {labelOf(APPROVAL_STATUS_LABELS, r.approval.status)}
              {r.approval.status === "pending" && (
                <>
                  {" · "}
                  <Link href="/savings/approvals" className="underline">
                    Savings Approvals
                  </Link>
                </>
              )}
            </Row>
          )}
          {r.transaction && (
            <Row label="Posted">
              <span className="font-mono">{r.transaction.reference}</span>, {formatDate(r.transaction.date)}
            </Row>
          )}
          {r.opened_account && (
            <Row label="Account opened">
              <Link href={`/savings/accounts/${r.opened_account.id}`} className="font-mono hover:underline">
                {r.opened_account.account_number}
              </Link>
            </Row>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
