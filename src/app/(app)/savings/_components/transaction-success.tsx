"use client";

import Link from "next/link";
import { CheckCircle2, Clock, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import type { SavingsTransaction } from "@/types/savings";
import { TRANSACTION_TYPE_LABEL } from "../_lib/account-status";
import { useSavingsReceipt } from "../_hooks/use-savings-receipt";

interface TransactionSuccessProps {
  transaction: SavingsTransaction;
  /** A transfer's other leg, shown beside the first. */
  other?: SavingsTransaction | null;
  onAnother: () => void;
  anotherLabel: string;
}

const amountOf = (tx: SavingsTransaction) => Math.max(Number(tx.debit), Number(tx.credit));
const balance = (value: SavingsTransaction["running_balance"]) => (value === null ? "—" : formatCurrency(value));

/** What was posted, with the server's balances and a receipt to print. */
export function TransactionSuccess({ transaction, other, onAnother, anotherLabel }: TransactionSuccessProps) {
  const receipt = useSavingsReceipt();
  const pending = transaction.status === "pending_approval";
  const legs = other ? [transaction, other] : [transaction];
  const Icon = pending ? Clock : CheckCircle2;

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="flex items-start gap-3">
          <Icon className={pending ? "mt-0.5 h-6 w-6 shrink-0 text-amber-600" : "mt-0.5 h-6 w-6 shrink-0 text-emerald-600"} />
          <div>
            <h2 className="font-semibold">
              {pending ? "Sent for approval" : `${TRANSACTION_TYPE_LABEL[transaction.type]} posted`}
            </h2>
            <p className="text-sm text-muted-foreground">
              Reference <span className="font-mono">{transaction.reference_number}</span> ·{" "}
              {formatDate(transaction.transaction_date)}
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {legs.map((leg) => (
            <dl key={leg.id} className="grid grid-cols-2 gap-2 rounded-md border p-3 text-sm">
              <dt className="text-muted-foreground">Account</dt>
              <dd className="font-mono">{leg.account_number}</dd>
              <dt className="text-muted-foreground">Member</dt>
              <dd className="truncate">{leg.member_name}</dd>
              <dt className="text-muted-foreground">{TRANSACTION_TYPE_LABEL[leg.type]}</dt>
              <dd className="font-medium">{formatCurrency(amountOf(leg))}</dd>
              <dt className="text-muted-foreground">Balance before</dt>
              <dd>{balance(leg.previous_balance)}</dd>
              <dt className="text-muted-foreground">New balance</dt>
              <dd className="font-semibold">{balance(leg.running_balance)}</dd>
            </dl>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" render={<Link href={`/savings/accounts/${transaction.account_id}`} />}>
            View account
          </Button>
          <Button variant="outline" onClick={() => receipt.print(transaction)} disabled={receipt.printing}>
            <Printer className="mr-2 h-4 w-4" />
            {receipt.printing ? "Preparing…" : "Print receipt"}
          </Button>
          <Button onClick={onAnother}>{anotherLabel}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
