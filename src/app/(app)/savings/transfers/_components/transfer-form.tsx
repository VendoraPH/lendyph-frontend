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
import type { SavingsTransferPayload, SavingsTransferResult } from "@/types/savings";
import { AccountLookup } from "../../_components/account-lookup";
import { ConfirmActionDialog } from "../../_components/confirm-action-dialog";
import { NeedsAccountView } from "../../_components/needs-account-view";
import { TransactionFields } from "../../_components/transaction-fields";
import { TransactionSuccess } from "../../_components/transaction-success";
import { useSavingsAccount } from "../../_hooks/use-savings-account";
import { parseAccountParam } from "../../_lib/account-param";
import { projectedBalance } from "../../_lib/savings-rules";
import { emptyTransferForm, transferPayload, type TransferForm } from "../../_lib/transaction-form";

/** Account-to-account transfer: both legs post in one server transaction. */
export function TransferFormContent() {
  const canView = usePermission().can("savings:view");
  const preselect = parseAccountParam(useSearchParams().get("account"));
  const guard = useSubmitGuard();
  const [today] = useState(todayISO);
  const [form, setForm] = useState<TransferForm>(() => emptyTransferForm(today, preselect));
  const [pending, setPending] = useState<SavingsTransferPayload | null>(null);
  const [posted, setPosted] = useState<SavingsTransferResult | null>(null);
  const from = useSavingsAccount(canView ? form.from_account_id : null);
  const to = useSavingsAccount(canView ? form.to_account_id : null);

  const set = <K extends keyof TransferForm>(key: K, value: TransferForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  if (!canView) return <NeedsAccountView action="A transfer" />;

  const review = () => {
    const check = transferPayload(form, from.account, to.account, today);
    if (!check.ok) {
      if (check.message) notifyWarning(check.message);
      else notifyValidation(check.fields);
      return;
    }
    setPending(check.payload);
  };

  const submit = async () => {
    if (!pending) return;
    const result = await guard.run((key) => savingsTransactionService.transfer(pending, key));
    if (!result) return;
    notifySuccess(
      result.debit.status === "pending_approval" ? "Transfer sent for approval" : "Transfer posted",
      result.reference_number,
    );
    setPending(null);
    setPosted(result);
  };

  const another = () => {
    setPosted(null);
    setForm(emptyTransferForm(today));
  };

  const sides = pending && from.account && to.account
    ? [
        { label: "From", account: from.account, direction: "out" as const },
        { label: "To", account: to.account, direction: "in" as const },
      ]
    : [];

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Fund transfer"
        description="Move money between two savings accounts. Both sides post together, or neither does."
      />
      {posted ? (
        // The debit leg names the counterparty, so its receipt covers both sides.
        <TransactionSuccess transaction={posted.debit} other={posted.credit} onAnother={another} anotherLabel="New transfer" />
      ) : (
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <AccountLookup
                id="transfer-from"
                label="Source account"
                value={form.from_account_id}
                onChange={(id) => set("from_account_id", id)}
                account={from.account}
                resource={from.resource}
                excludeId={form.to_account_id}
                disabled={guard.submitting}
              />
              <AccountLookup
                id="transfer-to"
                label="Destination account"
                value={form.to_account_id}
                onChange={(id) => set("to_account_id", id)}
                account={to.account}
                resource={to.resource}
                excludeId={form.from_account_id}
                disabled={guard.submitting}
              />
            </div>
            <TransactionFields
              idPrefix="transfer"
              amountLabel="Transfer amount"
              form={form}
              set={set}
              today={today}
              disabled={guard.submitting}
            />
            <div className="flex justify-end">
              <Button
                onClick={review}
                disabled={guard.submitting}
                className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              >
                Review transfer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmActionDialog
        open={pending !== null}
        onOpenChange={(open) => !open && !guard.submitting && setPending(null)}
        title={pending ? `Transfer ${formatCurrency(pending.amount)}?` : ""}
        description={pending ? `Dated ${formatDate(pending.transaction_date)}. Both accounts are updated in one posting.` : ""}
        confirmLabel="Post transfer"
        onConfirm={submit}
        errorFallback="The transfer could not be posted."
      >
        {pending && (
          <div className="grid gap-3 sm:grid-cols-2">
            {sides.map(({ label, account, direction }) => (
              <dl key={label} className="grid grid-cols-2 gap-1 rounded-md border p-3 text-sm">
                <dt className="col-span-2 font-medium">{label}</dt>
                <dt className="text-muted-foreground">Account</dt>
                <dd className="font-mono">{account.account_number}</dd>
                <dt className="text-muted-foreground">Member</dt>
                <dd className="truncate">{account.member.full_name}</dd>
                <dt className="text-muted-foreground">Balance</dt>
                <dd>{formatCurrency(account.ledger_balance)}</dd>
                <dt className="text-muted-foreground">Expected after</dt>
                <dd className="font-semibold">
                  {formatCurrency(projectedBalance(account.ledger_balance, pending.amount, direction))}
                </dd>
              </dl>
            ))}
          </div>
        )}
      </ConfirmActionDialog>
    </div>
  );
}
