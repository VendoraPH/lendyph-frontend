"use client";

import { useCallback, useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatCurrency, formatRate } from "@/lib/format";
import { notifyInfo } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { humanize } from "@/lib/portal/labels";
import { maxWithdrawable } from "@/lib/portal/requests";
import { portalService } from "@/services/portal.service";
import type { PortalRequestType, PortalSavingsAccount } from "@/types/portal";
import { NewRequestDialog } from "../../_components/new-request-dialog";
import { usePortalConfig } from "../../_components/portal-config";
import { PortalPageHeader } from "../../_components/portal-shell";
import { ServiceOff } from "../../_components/service-off";
import { SavingsLedgerCard } from "./_components/savings-ledger-card";
import { TimeDepositsCard } from "./_components/time-deposits-card";

interface Asking {
  type: PortalRequestType;
  values: Record<string, string>;
}

const followUp = () => notifyInfo("You can follow it under Requests.");

export default function MemberSavingsPage() {
  const { config } = usePortalConfig();
  const { savings, time_deposits, withdrawal_requests } = config.features;
  const fetcher = useCallback(() => portalService.savings(), []);
  const resource = useApiResource(fetcher, savings);
  const [asking, setAsking] = useState<Asking | null>(null);
  const ask = (type: PortalRequestType, values: Record<string, string> = {}) => setAsking({ type, values });

  return (
    <>
      <PortalPageHeader
        title="Savings"
        description="Your savings accounts and time deposits."
        actions={
          savings && (
            <Button size="sm" variant="outline" onClick={() => ask("savings_opening")}>
              <Plus className="mr-1.5 h-4 w-4" /> Open an account
            </Button>
          )
        }
      />
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
            {(rows) => (
              <Accounts
                accounts={rows}
                onWithdraw={
                  withdrawal_requests ? (a) => ask("savings_withdrawal", { account_id: String(a.id) }) : undefined
                }
              />
            )}
          </DataState>
        )}
        {time_deposits && (
          <TimeDepositsCard onInstruct={(td) => ask("time_deposit_instruction", { time_deposit_id: String(td.id) })} />
        )}
      </div>
      <NewRequestDialog
        open={asking !== null}
        onOpenChange={(o) => !o && setAsking(null)}
        initialType={asking?.type}
        initialValues={asking?.values}
        onSubmitted={followUp}
      />
    </>
  );
}

function Accounts({
  accounts,
  onWithdraw,
}: {
  accounts: PortalSavingsAccount[];
  /** Absent when withdrawal requests are switched off. */
  onWithdraw?: (account: PortalSavingsAccount) => void;
}) {
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
                {a.pending_withdrawal != null && (
                  <p className="text-xs text-amber-600">{formatCurrency(a.pending_withdrawal)} withdrawal pending</p>
                )}
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
      {selected && onWithdraw && selected.status === "active" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          <span>
            You can withdraw up to{" "}
            <span className="font-semibold">{formatCurrency(maxWithdrawable(selected))}</span> from{" "}
            {selected.account_number}.
          </span>
          <Button size="sm" disabled={maxWithdrawable(selected) <= 0} onClick={() => onWithdraw(selected)}>
            <ArrowUpRight className="mr-1.5 h-4 w-4" /> Request withdrawal
          </Button>
        </div>
      )}
      {selected && <SavingsLedgerCard key={selected.id} account={selected} />}
    </div>
  );
}
