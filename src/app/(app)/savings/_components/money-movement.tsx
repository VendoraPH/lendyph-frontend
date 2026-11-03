"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePermission, useSubmitGuard } from "@/hooks";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { notifySuccess, notifyValidation, notifyWarning } from "@/lib/notify";
import { savingsTransactionService } from "@/services/savings-transaction.service";
import type { SavingsDepositPayload, SavingsTransaction } from "@/types/savings";
import { parseAccountParam } from "../_lib/account-param";
import { paymentMethodLabel } from "../_lib/payment-methods";
import { canDeposit, canWithdraw, projectedBalance } from "../_lib/savings-rules";
import {
  emptyMovementForm,
  movementPayload,
  type MovementForm,
  type MovementMode,
} from "../_lib/transaction-form";
import { useSavingsAccount } from "../_hooks/use-savings-account";
import { AccountLookup } from "./account-lookup";
import { ConfirmActionDialog } from "./confirm-action-dialog";
import { NeedsAccountView } from "./needs-account-view";
import { TransactionFields } from "./transaction-fields";
import { TransactionSuccess } from "./transaction-success";

const COPY: Record<
  MovementMode,
  { title: string; description: string; amountLabel: string; verb: string; direction: "in" | "out" }
> = {
  deposit: {
    title: "Deposit",
    description: "Find the account, enter the amount received and post it. The new balance prints on the receipt.",
    amountLabel: "Deposit amount",
    verb: "Post deposit",
    direction: "in",
  },
  withdrawal: {
    title: "Withdrawal",
    description: "Find the account and enter the amount paid out. The maintaining balance must stay on the account.",
    amountLabel: "Withdrawal amount",
    verb: "Post withdrawal",
    direction: "out",
  },
};

/** The deposit and withdrawal screens: one flow, two directions. */
export function MoneyMovement({ mode }: { mode: MovementMode }) {
  const copy = COPY[mode];
  const canView = usePermission().can("savings:view");
  const preselect = parseAccountParam(useSearchParams().get("account"));
  const guard = useSubmitGuard();
  const [today] = useState(todayISO);
  const [form, setForm] = useState<MovementForm>(() => emptyMovementForm(today, preselect));
  const [pending, setPending] = useState<SavingsDepositPayload | null>(null);
  const [posted, setPosted] = useState<SavingsTransaction | null>(null);
  const { resource, account } = useSavingsAccount(canView ? form.account_id : null);

  const set = <K extends keyof MovementForm>(key: K, value: MovementForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  if (!canView) return <NeedsAccountView action={`Posting a ${mode}`} />;

  const blocked = account ? (mode === "deposit" ? canDeposit(account) : canWithdraw(account)) : null;

  const review = () => {
    const check = movementPayload(mode, form, account, today);
    if (!check.ok) {
      if (check.message) notifyWarning(check.message);
      else notifyValidation(check.fields);
      return;
    }
    setPending(check.payload);
  };

  const submit = async () => {
    if (!pending) return;
    const result = await guard.run((key) =>
      mode === "deposit"
        ? savingsTransactionService.deposit(pending, key)
        : savingsTransactionService.withdraw(pending, key),
    );
    if (!result) return;
    notifySuccess(
      result.status === "pending_approval" ? `${copy.title} sent for approval` : `${copy.title} posted`,
      result.reference_number,
    );
    setPending(null);
    setPosted(result);
  };

  const another = () => {
    setPosted(null);
    setForm(emptyMovementForm(today));
  };

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title={copy.title} description={copy.description} />
      {posted ? (
        <TransactionSuccess transaction={posted} onAnother={another} anotherLabel={`New ${mode}`} />
      ) : (
        <Card>
          <CardContent className="space-y-6 pt-6">
            <AccountLookup
              id={`${mode}-account`}
              label="Account"
              value={form.account_id}
              onChange={(id) => set("account_id", id)}
              account={account}
              resource={resource}
              disabled={guard.submitting}
            />
            {blocked && !blocked.ok && (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                {blocked.message}
              </p>
            )}
            <TransactionFields
              idPrefix={mode}
              amountLabel={copy.amountLabel}
              form={form}
              set={set}
              today={today}
              disabled={guard.submitting}
            />
            <div className="flex justify-end">
              <Button
                onClick={review}
                disabled={guard.submitting || (blocked !== null && !blocked.ok)}
                className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              >
                Review {mode}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmActionDialog
        open={pending !== null}
        onOpenChange={(open) => !open && !guard.submitting && setPending(null)}
        title={`${copy.verb}?`}
        description="Check the figures. The server posts it against the account's live balance."
        confirmLabel={copy.verb}
        onConfirm={submit}
        errorFallback={`The ${mode} could not be posted.`}
      >
        {pending && account && (
          <dl className="grid grid-cols-2 gap-2 rounded-md border p-3 text-sm">
            <dt className="text-muted-foreground">Account</dt>
            <dd className="font-mono">{account.account_number}</dd>
            <dt className="text-muted-foreground">Member</dt>
            <dd className="truncate">{account.member.full_name}</dd>
            <dt className="text-muted-foreground">Date</dt>
            <dd>{formatDate(pending.transaction_date)}</dd>
            <dt className="text-muted-foreground">Payment method</dt>
            <dd>{paymentMethodLabel(pending.payment_method)}</dd>
            <dt className="text-muted-foreground">Current balance</dt>
            <dd>{formatCurrency(account.ledger_balance)}</dd>
            <dt className="text-muted-foreground">{copy.amountLabel}</dt>
            <dd className="font-medium">{formatCurrency(pending.amount)}</dd>
            <dt className="text-muted-foreground">Expected new balance</dt>
            <dd className="font-semibold">
              {formatCurrency(projectedBalance(account.ledger_balance, pending.amount, copy.direction))}
            </dd>
          </dl>
        )}
      </ConfirmActionDialog>
    </div>
  );
}
