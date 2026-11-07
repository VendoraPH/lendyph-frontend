"use client";

import { useCallback, useState } from "react";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatCurrency, formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { humanize } from "@/lib/portal/labels";
import { portalService } from "@/services/portal.service";
import type { PortalSavingsAccount } from "@/types/portal";
import { usePortalConfig } from "../../_components/portal-config";
import { PortalPageHeader } from "../../_components/portal-shell";
import { ServiceOff } from "../../_components/service-off";
import { SavingsLedgerCard } from "./_components/savings-ledger-card";
import { TimeDepositsCard } from "./_components/time-deposits-card";

export default function MemberSavingsPage() {
  const { config } = usePortalConfig();
  const { savings, time_deposits } = config.features;
  const fetcher = useCallback(() => portalService.savings(), []);
  const resource = useApiResource(fetcher, savings);

  return (
    <>
      <PortalPageHeader title="Savings" description="Your savings accounts and time deposits." />
      <div className="space-y-5">
        {!savings ? (
          <ServiceOff service="Savings information" />
        ) : (
          <DataState
            resource={resource}
            endpoints={["GET /portal/savings"]}
            summary="Your savings balances and transactions will show here once online access is connected."
            isEmpty={(rows) => rows.length === 0}
            emptyMessage="You have no savings accounts."
          >
            {(rows) => <Accounts accounts={rows} />}
          </DataState>
        )}
        {time_deposits && <TimeDepositsCard />}
      </div>
    </>
  );
}

function Accounts({ accounts }: { accounts: PortalSavingsAccount[] }) {
  const [selectedId, setSelectedId] = useState(accounts[0]?.id);
  const selected = accounts.find((a) => a.id === selectedId) ?? accounts[0];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {accounts.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setSelectedId(a.id)}
            aria-pressed={a.id === selected?.id}
            className="text-left"
          >
            <Card className={cn("transition-colors hover:bg-muted/40", a.id === selected?.id && "ring-2 ring-brand-orange")}>
              <CardContent className="space-y-1 p-4">
                <p className="text-sm font-medium">{a.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  {a.account_number} · {humanize(a.status)} · {formatRate(a.interest_rate)}% a year
                </p>
                <p className="pt-1 text-xl font-semibold">{formatCurrency(a.balance)}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(a.available_balance)} available</p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
      {selected && <SavingsLedgerCard key={selected.id} account={selected} />}
    </div>
  );
}
