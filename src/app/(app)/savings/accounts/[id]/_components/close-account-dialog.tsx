"use client";

import { useCallback, useState } from "react";
import { useApiResource, useDialogOpening, useSubmitGuard } from "@/hooks";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { savingsAccountService } from "@/services/savings-account.service";
import type { SavingsAccount, SavingsPaymentMethod } from "@/types/savings";
import { ConfirmActionDialog } from "../../../_components/confirm-action-dialog";
import { PAYMENT_METHOD_OPTIONS } from "../../../_lib/payment-methods";

interface CloseAccountDialogProps {
  account: SavingsAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/** Closing quote body: what the server says closing would pay out, or why it can't close. */
function Quote({ accountId }: { accountId: number }) {
  const fetcher = useCallback(() => savingsAccountService.closingQuote(accountId), [accountId]);
  const { data: quote, loading, error, unavailable } = useApiResource(fetcher);
  if (loading) return <Skeleton className="h-20 w-full" />;
  if (unavailable) return <p className="text-sm text-muted-foreground">The closing quote is not connected yet.</p>;
  if (error || !quote) return <p className="text-sm text-destructive">We couldn&apos;t get the closing quote.</p>;
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-2 rounded-md border p-3 text-sm">
        <dt className="text-muted-foreground">Ledger balance</dt>
        <dd className="text-right">{formatCurrency(quote.ledger_balance)}</dd>
        <dt className="text-muted-foreground">Accrued interest</dt>
        <dd className="text-right">{formatCurrency(quote.accrued_interest)}</dd>
        <dt className="font-medium">Payout</dt>
        <dd className="text-right font-semibold">{formatCurrency(quote.payout_amount)}</dd>
      </dl>
      {!quote.can_close && (
        <ul className="list-disc space-y-1 rounded-md bg-red-50 p-3 pl-6 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {quote.blockers.length > 0 ? quote.blockers.map((b) => <li key={b}>{b}</li>) : <li>This account can&apos;t be closed now.</li>}
        </ul>
      )}
    </div>
  );
}

/**
 * Closes the account: shows the server's quote (balance plus accrued interest
 * to pay out), takes a reason and payout method, and posts once.
 */
export function CloseAccountDialog({ account, open, onOpenChange, onDone }: CloseAccountDialogProps) {
  const guard = useSubmitGuard();
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<SavingsPaymentMethod>("cash");
  if (useDialogOpening(open, account)) {
    setReason("");
    setMethod("cash");
  }

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Close ${account.account_number}?`}
      description="The balance and accrued interest are paid out and the account closes. This can't be undone."
      confirmLabel="Close account"
      destructive
      confirmDisabled={!reason.trim() || guard.submitting}
      errorFallback="The account could not be closed."
      onConfirm={async () => {
        const closed = await guard.run((key) =>
          savingsAccountService.close(account.id, { reason: reason.trim(), payment_method: method }, key),
        );
        if (!closed) return;
        notifySuccess("Account closed", account.account_number);
        onDone();
      }}
    >
      <div className="space-y-4">
        {open && <Quote key={account.id} accountId={account.id} />}
        <div className="space-y-2">
          <Label htmlFor="close-method">Payout method</Label>
          <Select
            value={method}
            onValueChange={(v) => v && setMethod(v as SavingsPaymentMethod)}
            items={PAYMENT_METHOD_OPTIONS}
          >
            <SelectTrigger id="close-method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="close-reason">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea id="close-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
    </ConfirmActionDialog>
  );
}
