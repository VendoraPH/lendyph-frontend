"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Banknote, Building2, History, Smartphone, Wallet } from "lucide-react";
import { PermissionGate, RouteGuard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAccountingResource } from "@/hooks";
import { notifyError, notifySuccess } from "@/lib/notify";
import { accountingService } from "@/services";
import type { CashAccountKind, CashAccountPage } from "@/types";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { AccountingPageHeader } from "../_components/page-header";
import { DataState } from "../_components/data-state";
import { TransferDialog } from "../_components/transfer-dialog";
import { centavosOrDash } from "../_lib/server-figure";
import type { TransferPayload } from "../_lib/transfer-payload";
import {
  CASH_ACCOUNTS_PER_PAGE,
  accountHistoryHref,
  cashKindTotals,
  cashListIsIncomplete,
} from "./_lib/cash-bank";

const KIND_ICON: Record<CashAccountKind, typeof Wallet> = {
  cash: Banknote,
  gcash: Smartphone,
  maya: Smartphone,
  bank: Building2,
  wallet: Wallet,
};

function CashAndBankContent() {
  const [transferring, setTransferring] = useState(false);

  // One page of the server's largest size. The headline and the line per kind
  // are the server's `meta.totals`, over every money account in scope, so they
  // hold even when a chart has more accounts than this page shows.
  const fetcher = useCallback(
    () => accountingService.cashAccountsPage({ per_page: CASH_ACCOUNTS_PER_PAGE }),
    [],
  );
  const resource = useAccountingResource<CashAccountPage>(fetcher);

  const transfer = async (data: TransferPayload) => {
    try {
      await accountingService.transfer(data);
      notifySuccess("Transfer recorded");
      setTransferring(false);
      resource.refetch();
    } catch (err) {
      notifyError(err, "Could not record this transfer.");
    }
  };

  return (
    <div className="space-y-6">
      <AccountingPageHeader
        title="Cash & Bank"
        description="Cash on hand, bank accounts, GCash and Maya."
        actions={
          <PermissionGate permission="cash_accounts:transfer">
            <Button onClick={() => setTransferring(true)}>
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Transfer
            </Button>
          </PermissionGate>
        }
      />

      {/*
        Stated up front because it is the single most common accounting
        mistake a lending operation makes: moving your own money between your
        own accounts is not income, and recording it as such inflates the
        income statement by the full amount moved.
      */}
      <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        Moving money between your own accounts is a transfer, never income.
        Only a charge on the transfer is an expense.
      </div>

      <DataState
        resource={resource}
        summary="Balances per money account and movement between them."
        endpoints={[
          "GET /accounting/cash-accounts",
          "POST /accounting/cash-accounts/transfer",
        ]}
        isEmpty={(page) => (page.data ?? []).length === 0}
        emptyMessage="No cash or bank account has been set up."
      >
        {(page) => (
          <div className="space-y-4">
            <CashAccounts page={page} />
            <TransferDialog
              open={transferring}
              accounts={page.data ?? []}
              onOpenChange={setTransferring}
              onSubmit={transfer}
            />
          </div>
        )}
      </DataState>
    </div>
  );
}

export default function CashAndBankPage() {
  return (
    <RouteGuard permission="cash_accounts:view" pageName="Cash & Bank">
      <CashAndBankContent />
    </RouteGuard>
  );
}

/** The account cards, each with its history link, and the server's totals. */
function CashAccounts({ page }: { page: CashAccountPage }) {
  const accounts = page.data ?? [];
  const totals = page.meta?.totals;

  return (
    <>
      {cashListIsIncomplete(page.meta, accounts.length) && (
        <IncompleteListNotice
          shown={accounts.length}
          total={page.meta.total}
          noun="money accounts"
          consequence="The totals below still cover every money account, but an account missing here cannot be picked for a transfer."
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {accounts.map((account) => {
          const Icon = account.cash_kind ? KIND_ICON[account.cash_kind] : Wallet;
          return (
            <Card key={account.id}>
              <CardContent className="space-y-2 pt-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="h-4 w-4" aria-hidden />
                  <span className="text-sm">{account.name}</span>
                </div>
                <p className="font-mono text-2xl font-semibold">
                  {centavosOrDash(account.balance)}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-xs text-muted-foreground">{account.code}</p>
                  <Link
                    href={accountHistoryHref(account.id)}
                    className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`History of ${account.name}`}
                  >
                    <History className="h-3.5 w-3.5" aria-hidden />
                    History
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total across all money accounts</span>
            <span className="font-mono text-xl font-semibold">
              {centavosOrDash(totals?.balance)}
            </span>
          </div>
          {totals?.by_kind && (
            <dl className="grid gap-x-6 gap-y-1 border-t pt-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
              {cashKindTotals(totals.by_kind).map((line) => (
                <div key={line.kind} className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">{line.label}</dt>
                  <dd className="font-mono">{centavosOrDash(line.amount)}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </>
  );
}
