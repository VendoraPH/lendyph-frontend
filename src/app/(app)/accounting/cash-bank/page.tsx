"use client";

import { useCallback, useState } from "react";
import { ArrowLeftRight, Banknote, Building2, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PermissionGate, RouteGuard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAccountingResource } from "@/hooks";
import { accountingService } from "@/services";
import { formatCentavos, sumCentavos } from "@/lib/accounting/money";
import type { Account, CashAccountKind } from "@/types";
import { AccountingPageHeader } from "../_components/page-header";
import { DataState } from "../_components/data-state";
import { TransferDialog } from "../_components/transfer-dialog";

const KIND_ICON: Record<CashAccountKind, typeof Wallet> = {
  cash: Banknote,
  gcash: Smartphone,
  maya: Smartphone,
  bank: Building2,
  wallet: Wallet,
};

export default function CashAndBankPage() {
  const [transferring, setTransferring] = useState(false);

  const fetcher = useCallback(() => accountingService.listCashAccounts(), []);
  const resource = useAccountingResource<Account[]>(fetcher);

  const transfer = async (data: {
    date: string;
    from_account_id: number;
    to_account_id: number;
    amount: number;
    charge?: number;
    description: string;
  }) => {
    try {
      await accountingService.transfer(data);
      toast.success("Transfer recorded.");
      setTransferring(false);
      resource.refetch();
    } catch {
      toast.error("Could not record this transfer.");
    }
  };

  return (
    <RouteGuard permission="cash_accounts:view" pageName="Cash & Bank">
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
          isEmpty={(accounts) => accounts.length === 0}
          emptyMessage="No cash or bank account has been set up."
        >
          {(accounts) => (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {accounts.map((account) => {
                  const Icon = account.cash_kind
                    ? KIND_ICON[account.cash_kind]
                    : Wallet;
                  return (
                    <Card key={account.id}>
                      <CardContent className="space-y-2 pt-6">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm">{account.name}</span>
                        </div>
                        <p className="font-mono text-2xl font-semibold">
                          {formatCentavos(account.balance ?? 0)}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {account.code}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <span className="text-sm text-muted-foreground">
                    Total across all money accounts
                  </span>
                  <span className="font-mono text-xl font-semibold">
                    {formatCentavos(sumCentavos(accounts.map((a) => a.balance)))}
                  </span>
                </CardContent>
              </Card>

              <TransferDialog
                open={transferring}
                accounts={accounts}
                onOpenChange={setTransferring}
                onSubmit={transfer}
              />
            </div>
          )}
        </DataState>
      </div>
    </RouteGuard>
  );
}
