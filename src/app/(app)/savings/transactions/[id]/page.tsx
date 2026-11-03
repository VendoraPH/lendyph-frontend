"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { useApiResource } from "@/hooks";
import { RouteGuard } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { savingsTransactionService } from "@/services/savings-transaction.service";
import type { SavingsTransaction } from "@/types/savings";
import { ReversalDialogs, type ReversalAction, type ReversalTarget } from "../../_components/reversal-dialogs";
import { ToneBadge } from "../../_components/tone-badge";
import { useSavingsReceipt } from "../../_hooks/use-savings-receipt";
import { useTransactionPermissions } from "../../_hooks/use-transaction-permissions";
import {
  TRANSACTION_STATUS_LABEL,
  TRANSACTION_STATUS_TONE,
  TRANSACTION_TYPE_LABEL,
  transactionRowActions,
} from "../../_lib/account-status";
import { paymentMethodLabel } from "../../_lib/payment-methods";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

/**
 * Approve / reject a pending reversal. The requester can do neither (maker ≠
 * checker; the server refuses both), and a disabled button gets no hover, so
 * the reason sits in a tooltip on a wrapper rather than a `title`.
 */
function ReviewButtons({ ownRequest, onAction }: { ownRequest: boolean; onAction: (a: ReversalAction) => void }) {
  const buttons = (
    <span className="inline-flex gap-2">
      <Button variant="outline" onClick={() => onAction("approve")} disabled={ownRequest}>
        Approve reversal
      </Button>
      <Button variant="outline" className="text-destructive" onClick={() => onAction("reject")} disabled={ownRequest}>
        Reject reversal
      </Button>
    </span>
  );
  if (!ownRequest) return buttons;
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} />}>{buttons}</TooltipTrigger>
      <TooltipContent>You requested this reversal; another user must review it.</TooltipContent>
    </Tooltip>
  );
}

const money =(v: SavingsTransaction["running_balance"]) => (v === null ? "—" : formatCurrency(v));

function TransactionDetail({ tx, onChanged }: { tx: SavingsTransaction; onChanged: () => void }) {
  const user = useTransactionPermissions();
  const receipt = useSavingsReceipt();
  const [target, setTarget] = useState<ReversalTarget | null>(null);
  const actions = transactionRowActions(tx, user);
  const open = (action: ReversalAction) => setTarget({ action, tx });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${TRANSACTION_TYPE_LABEL[tx.type]} ${tx.reference_number}`}
        description={`${tx.member_name} · ${tx.account_number}`}
        actions={
          <>
            <ToneBadge tone={TRANSACTION_STATUS_TONE[tx.status]}>{TRANSACTION_STATUS_LABEL[tx.status]}</ToneBadge>
            <Button variant="outline" onClick={() => receipt.print(tx)} disabled={receipt.printing}>
              <Printer className="mr-2 h-4 w-4" />
              Print receipt
            </Button>
            {actions.reverse && (
              <Button variant="outline" className="text-destructive" onClick={() => open("reverse")}>
                Reverse
              </Button>
            )}
            {actions.review && <ReviewButtons ownRequest={actions.review.ownRequest} onAction={open} />}
          </>
        }
      />
      <Card>
        <CardContent className="pt-6">
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Date">{formatDate(tx.transaction_date)}</Field>
            <Field label="Recorded">{formatDateTime(tx.created_at)}</Field>
            <Field label="Account">
              <Link href={`/savings/accounts/${tx.account_id}`} className="font-mono underline-offset-2 hover:underline">
                {tx.account_number}
              </Link>
            </Field>
            <Field label="Branch">{tx.branch?.name ?? "—"}</Field>
            <Field label="Debit">{Number(tx.debit) ? formatCurrency(tx.debit) : "—"}</Field>
            <Field label="Credit">{Number(tx.credit) ? formatCurrency(tx.credit) : "—"}</Field>
            <Field label="Balance before">{money(tx.previous_balance)}</Field>
            <Field label="Balance after">{money(tx.running_balance)}</Field>
            <Field label="Payment method">{paymentMethodLabel(tx.payment_method)}</Field>
            <Field label="Processed by">{tx.processed_by?.name ?? "—"}</Field>
            <Field label="Approved by">{tx.approved_by?.name ?? "—"}</Field>
            {tx.counterparty && (
              <Field label="Other account">
                <Link
                  href={`/savings/accounts/${tx.counterparty.account_id}`}
                  className="font-mono underline-offset-2 hover:underline"
                >
                  {tx.counterparty.account_number}
                </Link>{" "}
                · {tx.counterparty.member_name}
              </Field>
            )}
            {tx.reversal_of && (
              <Field label="Reverses">
                <Link href={`/savings/transactions/${tx.reversal_of.id}`} className="font-mono underline-offset-2 hover:underline">
                  {tx.reversal_of.reference_number}
                </Link>
              </Field>
            )}
            {tx.reversed_by && (
              <Field label="Reversed by">
                <Link href={`/savings/transactions/${tx.reversed_by.id}`} className="font-mono underline-offset-2 hover:underline">
                  {tx.reversed_by.reference_number}
                </Link>
              </Field>
            )}
            {tx.pending_reversal && (
              <Field label="Reversal requested">
                {tx.pending_reversal.requested_by?.name ?? "—"}: {tx.pending_reversal.reason}
              </Field>
            )}
            <div className="sm:col-span-2 lg:col-span-4">
              <Field label="Remarks">{tx.remarks || tx.description || "—"}</Field>
            </div>
          </dl>
        </CardContent>
      </Card>
      <ReversalDialogs
        target={target}
        onClose={() => setTarget(null)}
        onDone={() => {
          setTarget(null);
          onChanged();
        }}
      />
    </div>
  );
}

function TransactionContent({ id }: { id: number }) {
  const fetcher = useCallback(() => savingsTransactionService.get(id), [id]);
  const resource = useApiResource(fetcher);
  return (
    <div className="min-w-0 space-y-6">
      <Link href="/savings/accounts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Savings accounts
      </Link>
      <DataState
        resource={resource}
        summary="One savings transaction with the balances it posted, and its reversal state."
        endpoints={["GET /savings/transactions/{id}"]}
      >
        {(tx) => <TransactionDetail tx={tx} onChanged={resource.refetch} />}
      </DataState>
    </div>
  );
}

export default function SavingsTransactionPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RouteGuard permission="savings:view" pageName="Savings Transaction">
      <TransactionContent key={id} id={Number(id)} />
    </RouteGuard>
  );
}
