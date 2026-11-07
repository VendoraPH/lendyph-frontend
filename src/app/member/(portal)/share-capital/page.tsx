"use client";

import { useCallback } from "react";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatCurrency, formatDate } from "@/lib/format";
import { portalService } from "@/services/portal.service";
import type { PortalShareCapital } from "@/types/portal";
import { LedgerTable } from "../../_components/ledger-table";
import { usePortalConfig } from "../../_components/portal-config";
import { PortalPageHeader } from "../../_components/portal-shell";
import { ServiceOff } from "../../_components/service-off";
import { DividendsCard } from "./_components/dividends-card";

export default function MemberShareCapitalPage() {
  const { config } = usePortalConfig();
  const enabled = config.features.share_capital;
  const fetchSummary = useCallback(() => portalService.shareCapital(), []);
  const summary = useApiResource(fetchSummary, enabled);
  const fetchLedger = useCallback(() => portalService.shareCapitalLedger(), []);
  const ledger = useApiResource(fetchLedger, enabled && !summary.unavailable);

  return (
    <>
      <PortalPageHeader title="Share capital" description="Your subscribed and paid-up shares in the cooperative." />
      {!enabled ? (
        <ServiceOff service="Share capital" />
      ) : (
        <div className="space-y-5">
          <DataState
            resource={summary}
            endpoints={["GET /portal/share-capital"]}
            summary="Your share capital balance will show here once online access is connected."
          >
            {(data) => <Summary data={data} />}
          </DataState>
          {!summary.unavailable && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <DataState
                  resource={ledger}
                  endpoints={["GET /portal/share-capital/transactions"]}
                  summary="Every share capital payment and adjustment."
                >
                  {(rows) => <LedgerTable entries={rows} />}
                </DataState>
              </CardContent>
            </Card>
          )}
          {!summary.unavailable && config.features.dividends && <DividendsCard />}
        </div>
      )}
    </>
  );
}

function Summary({ data }: { data: PortalShareCapital }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Stat label="Paid-up" value={formatCurrency(data.paid_up)} strong />
      <Stat label="Subscribed" value={formatCurrency(data.subscribed)} note={data.share_count != null ? `${data.share_count} shares` : undefined} />
      <Stat
        label="Still to pay on subscription"
        value={formatCurrency(data.unpaid_subscription)}
        note={data.last_transaction_at ? `Last payment ${formatDate(data.last_transaction_at)}` : undefined}
      />
    </div>
  );
}

function Stat({ label, value, note, strong }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={strong ? "text-xl font-semibold" : "text-lg font-medium"}>{value}</p>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}
