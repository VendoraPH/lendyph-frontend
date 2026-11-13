"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpFromLine,
  FileText,
  Landmark,
  Lock,
  Printer,
  ShieldAlert,
  Snowflake,
} from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionGate } from "@/components/common/permission-gate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource, usePermission } from "@/hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { ACCOUNT_DOCUMENTS } from "@/lib/savings/documents";
import { savingsService } from "@/services";
import type { SavingsAccount } from "@/types";
import type { SavingsAccountDetails } from "@/types/savings-servicing";
import { AccountStatusBadge } from "../../../_components/account-status-badge";
import { ActionButton } from "../../../_components/action-button";
import { DocumentsMenu } from "../../../_components/documents-menu";
import {
  canDeposit,
  canOfferClose,
  canWithdraw,
  heldForRequestsNote,
  outflowHoldNote,
  statusChangeOffers,
  type StatusOffer,
} from "../../../_lib/savings-rules";
import { printSavingsPassbook } from "../_lib/print-passbook";
import { accountDetailItems } from "../_lib/account-details";
import { shareCapitalTransferBlocker } from "../_lib/share-capital-transfer";
import { AccountNotesPanel } from "./account-notes-panel";
import { CloseAccountDialog } from "./close-account-dialog";
import { HoldsCard } from "./holds-card";
import { ShareCapitalTransferDialog } from "./share-capital-transfer-dialog";
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
  const [toShareCapital, setToShareCapital] = useState(false);
  const [statusOffer, setStatusOffer] = useState<StatusOffer | null>(null);
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
              onShareCapital={() => setToShareCapital(true)}
              onStatus={setStatusOffer}
              onClose={() => setClosing(true)}
            />
            <OutflowHoldNotice account={account} />
            <Balances account={account} />
            <OpeningDetails account={account} />
            <HoldsCard account={account} onChanged={() => resource.refetch()} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <TransactionsTable key={ledgerKey} account={account} onChanged={() => resource.refetch()} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <AccountNotesPanel accountId={account.id} />
              </CardContent>
            </Card>
            <TransactionDialog
              mode={mode}
              account={account}
              onOpenChange={(open) => !open && setMode(null)}
              onPosted={reload}
            />
            <TransferDialog open={transferring} account={account} onOpenChange={setTransferring} onPosted={reload} />
            <ShareCapitalTransferDialog
              open={toShareCapital}
              account={account}
              onOpenChange={setToShareCapital}
              onPosted={reload}
            />
            <StatusDialog
              offer={statusOffer}
              account={account}
              onOpenChange={(open) => !open && setStatusOffer(null)}
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
  onShareCapital,
  onStatus,
  onClose,
}: {
  account: SavingsAccount;
  printing: boolean;
  onPrint: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onTransfer: () => void;
  onShareCapital: () => void;
  onStatus: (offer: StatusOffer) => void;
  onClose: () => void;
}) {
  const statusOffers = statusChangeOffers(account);
  // The transfer to share capital needs share_capital:create as well as savings:post (backend S3).
  const canEnterShareCapital = usePermission().can("share_capital:create");
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
        <DocumentsMenu documents={ACCOUNT_DOCUMENTS} subjectId={account.id} />
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
            <ActionButton
              permission="savings:post"
              variant="outline"
              onClick={onShareCapital}
              blockedReason={
                canEnterShareCapital
                  ? shareCapitalTransferBlocker(account)
                  : "Transferring to share capital also needs the share capital entry permission."
              }
            >
              <Landmark className="h-4 w-4" /> Transfer to share capital
            </ActionButton>
            {statusOffers.map((offer) => (
              <ActionButton key={offer.label} permission="savings:close" variant="outline" onClick={() => onStatus(offer)}>
                <Snowflake className="h-4 w-4" /> {offer.label}
              </ActionButton>
            ))}
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
    { label: "On hold", value: account.hold_amount, note: heldForRequestsNote(account) },
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
            {"note" in i && i.note && <p className="mt-1 text-xs text-muted-foreground">{i.note}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** The reactivation hold (gap round B7), shown before anyone starts a withdrawal or transfer. */
function OutflowHoldNotice({ account }: { account: SavingsAccount }) {
  const note = account.status === "closed" ? null : outflowHoldNote(account);
  if (!note) return null;
  return (
    <Alert>
      <ShieldAlert />
      <AlertTitle>Outflows need a checker</AlertTitle>
      <AlertDescription>{note}</AlertDescription>
    </Alert>
  );
}

/** The opening details (gap round S1): officer, source of funds and beneficiary, as the server sent them. */
function OpeningDetails({ account }: { account: SavingsAccount & SavingsAccountDetails }) {
  return (
    <Card>
      <CardContent className="py-4">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {accountDetailItems(account).map((item) => (
            <div key={item.label}>
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="mt-0.5 font-medium">{item.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
