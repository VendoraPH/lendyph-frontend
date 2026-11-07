"use client";

import { useCallback, useState } from "react";
import { DataState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatCurrency, formatDate } from "@/lib/format";
import { notifyInfo } from "@/lib/notify";
import { AUTO_PAY_RUN_STATUS, AUTO_PAY_STATUS } from "@/lib/portal/engagement";
import { TONE_CLASS } from "@/lib/portal/labels";
import { portalService } from "@/services/portal.service";
import type { PortalAutoPay } from "@/types/portal";
import { DetailItem } from "../../../_components/detail-item";
import { NewRequestDialog } from "../../../_components/new-request-dialog";
import { StatusPill } from "../../../_components/portal-shell";

/**
 * Automatic loan payments. Members cannot change one directly: every start,
 * change or stop goes to the cooperative as an `auto_pay` request.
 */
export function AutoPayCard() {
  const fetcher = useCallback(() => portalService.autoPay(), []);
  const resource = useApiResource(fetcher);
  const [asking, setAsking] = useState<Record<string, string> | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Auto-pay</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAsking({ action: "enable" })}>
          Set up auto-pay
        </Button>
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          endpoints={["GET /portal/auto-pay"]}
          summary="Automatic payments set up on your loans."
          isEmpty={(rows) => rows.length === 0}
          emptyMessage="You have no automatic payments. Set one up and the cooperative will confirm it."
        >
          {(rows) => (
            <div className="divide-y">
              {rows.map((row) => (
                <AutoPayRow key={row.id} row={row} onAsk={setAsking} />
              ))}
            </div>
          )}
        </DataState>
      </CardContent>
      <NewRequestDialog
        open={asking !== null}
        onOpenChange={(open) => !open && setAsking(null)}
        initialType="auto_pay"
        initialValues={asking ?? undefined}
        onSubmitted={() => notifyInfo("You can follow it under Requests.")}
      />
    </Card>
  );
}

function AutoPayRow({ row, onAsk }: { row: PortalAutoPay; onAsk: (values: Record<string, string>) => void }) {
  const [showHistory, setShowHistory] = useState(false);
  const status = AUTO_PAY_STATUS[row.status] ?? AUTO_PAY_STATUS.pending;
  const loan = { loan_id: String(row.loan_id) };
  const live = row.status === "active" || row.status === "paused" || row.status === "failed";

  return (
    <div className="space-y-3 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{row.loan_number}</p>
        <StatusPill className={TONE_CLASS[status.tone]}>{status.label}</StatusPill>
        {live && (
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => onAsk({ action: "update", ...loan })}>
              Change
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onAsk({ action: "disable", ...loan })}>
              Stop
            </Button>
          </div>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <DetailItem label="Amount" value={formatCurrency(row.amount)} />
        <DetailItem label="Schedule" value={row.schedule} />
        <DetailItem label="Paid from" value={row.source} />
        <DetailItem label="Next run" value={row.next_run ? formatDate(row.next_run) : null} />
      </dl>
      {row.history.length > 0 && (
        <div>
          <Button size="sm" variant="link" className="h-auto p-0" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? "Hide history" : `Show history (${row.history.length})`}
          </Button>
          {showHistory && (
            <ul className="mt-2 space-y-1.5 text-sm">
              {row.history.map((h) => {
                const run = AUTO_PAY_RUN_STATUS[h.status] ?? AUTO_PAY_RUN_STATUS.skipped;
                return (
                  <li key={h.id} className="flex flex-wrap items-center gap-2">
                    <span className="w-24 text-muted-foreground">{formatDate(h.date)}</span>
                    <span className="w-28">{formatCurrency(h.amount)}</span>
                    <StatusPill className={TONE_CLASS[run.tone]}>{run.label}</StatusPill>
                    {h.note && <span className="text-muted-foreground">{h.note}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
