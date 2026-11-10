"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpFromLine,
  FileText,
  Lock,
  Printer,
  Snowflake,
} from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionGate } from "@/components/common/permission-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { savingsService } from "@/services";
import type { SavingsAccount } from "@/types";
import { AccountStatusBadge } from "../../../_components/account-status-badge";
import { ActionButton } from "../../../_components/action-button";
import {
  canDeposit,
  canOfferClose,
  canWithdraw,
  statusChangeOffer,
} from "../../../_lib/savings-rules";
import { printSavingsPassbook } from "../_lib/print-passbook";
import { CloseAccountDialog } from "./close-account-dialog";
import { HoldsCard } from "./holds-card";
import { StatusDialog } from "./status-dialog";
import { TransferDialog } from "./transfer-dialog";
import { TransactionDialog, type TransactionMode } from "./transaction-dialog";
import { TransactionsTable } from "./transactions-table";

export function AccountDetail({ accountId }: { accountId: number }) {
  const fetcher = useCallback(() => savingsService.account(accountId), [accountId]);
  const resource = useApiResource(fetcher);
  const [ledgerKey, setLedgerKey] = useState(0);
  const [mode, setMode] = useState<TransactionMode | null>(null);
  const [closing, setClosing] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [printing, setPrinting] = useState(false);

  const printPassbook = (account: SavingsAccount) => {
    setPrinting(true);
    printSavingsPassbook(account).then(() => setPrinting(false));
  };

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
        summary="This account's balances and ledger will show here once the savings service is connected."
      >
        {(account) => (
          <>
            <Header
              account={account}
              printing={printing}
              onPrint={() => printPassbook(account)}
              onDeposit={() => setMode("deposit")}
              onWithdraw={() => setMode("withdrawal")}
              onTransfer={() => setTransferring(true)}
              onStatus={() => setChangingStatus(true)}
              onClose={() => setClosing(true)}
            />
            <Balances account={account} />
            <HoldsCard account={account} onChanged={() => resource.refetch()} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <TransactionsTable key={ledgerKey} accountId={account.id} onChanged={() => resource.refetch()} />
              </CardContent>
            </Card>
            <TransactionDialog
              mode={mode}
              account={account}
              onOpenChange={(open) => !open && setMode(null)}
              onPosted={reload}
            />
            <TransferDialog open={transferring} account={account} onOpenChange={setTransferring} onPosted={reload} />
            <StatusDialog
              open={changingStatus}
              account={account}
              onOpenChange={setChangingStatus}
              onChanged={() => resource.refetch()}
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
  printing,
  onPrint,
  onDeposit,
  onWithdraw,
  onTransfer,
  onStatus,
  onClose,
}: {
  account: SavingsAccount;
  printing: boolean;
  onPrint: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onTransfer: () => void;
  onStatus: () => void;
  onClose: () => void;
}) {
  const statusOffer = statusChangeOffer(account);
  const notActive = canWithdraw(account) ? null : "Only an active account can be withdrawn from or transferred out of.";
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
          Opened {formatDate(account.opened_on)}
          {account.dormant_since && ` · Dormant since ${formatDate(account.dormant_since)}`}
          {account.closed_on && ` · Closed ${formatDate(account.closed_on)}`}
          {account.interest_credited_through &&
            ` · Interest credited through ${formatDate(account.interest_credited_through)}`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onPrint} disabled={printing}>
          <Printer className="h-4 w-4" /> {printing ? "Preparing…" : "Print passbook"}
        </Button>
        <PermissionGate permission="reports:view">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/reports/savings_statement?account=${account.id}`} />}
          >
            <FileText className="h-4 w-4" /> Statement
          </Button>
        </PermissionGate>
        {account.status !== "closed" && (
          <>
            <ActionButton
              permission="savings:transact"
              onClick={onDeposit}
              blockedReason={canDeposit(account) ? null : "A frozen account takes no deposits."}
            >
              <ArrowDownToLine className="h-4 w-4" /> Deposit
            </ActionButton>
            <ActionButton permission="savings:transact" variant="outline" onClick={onWithdraw} blockedReason={notActive}>
              <ArrowUpFromLine className="h-4 w-4" /> Withdraw
            </ActionButton>
            <ActionButton permission="savings:transact" variant="outline" onClick={onTransfer} blockedReason={notActive}>
              <ArrowLeftRight className="h-4 w-4" /> Transfer
            </ActionButton>
            {statusOffer && (
              <ActionButton permission="savings:close" variant="outline" onClick={onStatus}>
                <Snowflake className="h-4 w-4" /> {statusOffer.label}
              </ActionButton>
            )}
            <ActionButton
              permission="savings:close"
              variant="outline"
              onClick={onClose}
              blockedReason={canOfferClose(account) ? null : "This account is already closed."}
            >
              <Lock className="h-4 w-4" /> Close
            </ActionButton>
          </>
        )}
      </div>
    </div>
  );
}

function Balances({ account }: { account: SavingsAccount }) {
  const items = [
    { label: "Balance", value: account.balance, strong: true },
    { label: "Available to withdraw", value: account.available_balance },
    { label: "On hold", value: account.hold_amount },
    { label: "Waiting for approval", value: account.pending_amount },
    { label: "Accrued interest (not yet credited)", value: account.accrued_interest },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
