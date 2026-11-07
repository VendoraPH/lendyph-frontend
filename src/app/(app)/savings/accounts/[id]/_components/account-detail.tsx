"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Lock } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { savingsService } from "@/services";
import type { SavingsAccount } from "@/types";
import { AccountStatusBadge } from "../../../_components/account-status-badge";
import { canClose, canDeposit, canWithdraw } from "../../../_lib/savings-rules";
import { CloseAccountDialog } from "./close-account-dialog";
import { TransactionDialog, type TransactionMode } from "./transaction-dialog";
import { TransactionsTable } from "./transactions-table";

export function AccountDetail({ accountId }: { accountId: number }) {
  const fetcher = useCallback(() => savingsService.account(accountId), [accountId]);
  const resource = useApiResource(fetcher);
  const [ledgerKey, setLedgerKey] = useState(0);
  const [mode, setMode] = useState<TransactionMode | null>(null);
  const [closing, setClosing] = useState(false);

  const reload = () => {
    resource.refetch();
    setLedgerKey((k) => k + 1);
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/savings" />}>
        <ArrowLeft className="h-4 w-4" /> Savings accounts
      </Button>

      <DataState
        resource={resource}
        endpoints={["GET /savings/accounts/{id}"]}
        summary="This account's balances and ledger will show here once the backend is connected."
      >
        {(account) => (
          <>
            <Header account={account} onDeposit={() => setMode("deposit")} onWithdraw={() => setMode("withdrawal")} onClose={() => setClosing(true)} />
            <Balances account={account} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <TransactionsTable key={ledgerKey} accountId={account.id} />
              </CardContent>
            </Card>
            <TransactionDialog
              mode={mode}
              account={account}
              onOpenChange={(open) => !open && setMode(null)}
              onPosted={reload}
            />
            <CloseAccountDialog open={closing} account={account} onOpenChange={setClosing} onClosed={reload} />
          </>
        )}
      </DataState>
    </div>
  );
}

function Header({
  account,
  onDeposit,
  onWithdraw,
  onClose,
}: {
  account: SavingsAccount;
  onDeposit: () => void;
  onWithdraw: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{account.account_number}</h1>
          <AccountStatusBadge status={account.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/borrowers/${account.borrower_id}`} className="font-medium text-foreground hover:underline">
            {account.borrower_name ?? "Member"}
          </Link>
          {account.borrower_code && ` · ${account.borrower_code}`} · {account.product.name}
          {account.branch_name && ` · ${account.branch_name}`}
        </p>
        <p className="text-xs text-muted-foreground">
          Opened {formatDate(account.opened_at)}
          {account.closed_at && ` · Closed ${formatDate(account.closed_at)}`}
        </p>
      </div>
      {account.status !== "closed" && (
        <div className="flex flex-wrap gap-2">
          <PermissionButton permission="savings:transact" onClick={onDeposit} disabled={!canDeposit(account)}>
            <ArrowDownToLine className="h-4 w-4" /> Deposit
          </PermissionButton>
          <PermissionButton
            permission="savings:transact"
            variant="outline"
            onClick={onWithdraw}
            disabled={!canWithdraw(account)}
            title={canWithdraw(account) ? undefined : "Only an active account can be withdrawn from."}
          >
            <ArrowUpFromLine className="h-4 w-4" /> Withdraw
          </PermissionButton>
          <PermissionButton
            permission="savings:close"
            variant="outline"
            onClick={onClose}
            disabled={!canClose(account)}
            title={canClose(account) ? undefined : "Release the holds on this account before closing it."}
          >
            <Lock className="h-4 w-4" /> Close
          </PermissionButton>
        </div>
      )}
    </div>
  );
}

function Balances({ account }: { account: SavingsAccount }) {
  const items = [
    { label: "Balance", value: account.balance, strong: true },
    { label: "Available to withdraw", value: account.available_balance },
    { label: "On hold", value: account.hold_amount },
    { label: "Accrued interest", value: account.accrued_interest },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((i) => (
        <Card key={i.label}>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">{i.label}</p>
            <p className={`mt-1 tabular-nums ${i.strong ? "text-2xl font-semibold" : "text-xl font-medium"}`}>
              {formatCurrency(i.value)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
