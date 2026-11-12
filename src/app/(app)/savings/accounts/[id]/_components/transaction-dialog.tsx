"use client";

import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApiResource, useDialogOpening } from "@/hooks";
import { formatCurrency, todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { isReceiptTransaction, receiptAmount } from "@/lib/printables/templates/savings-receipt";
import { savingsService } from "@/services";
import type { SavingsAccount, SavingsMethod } from "@/types";
import { FormField } from "../../../_components/field";
import { OptionSelect } from "../../../_components/option-select";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { parseMoneyInput } from "@/lib/money-input";
import { moneyPostMessage } from "@/lib/savings/money-post";
import { feeOf, postedWithdrawalText, withFeeText, withdrawalFeeRuleHint } from "@/lib/savings/withdrawal-fee";
import type { SavingsWithdrawalRule } from "@/types/savings-servicing";
import { PAYMENT_METHOD_OPTIONS } from "../../../_lib/savings-rules";
import { printSavingsReceipt } from "../_lib/print-receipt";

export type TransactionMode = "deposit" | "withdrawal";

interface TransactionDialogProps {
  mode: TransactionMode | null;
  account: SavingsAccount;
  onOpenChange: (open: boolean) => void;
  onPosted: () => void;
}

const COPY: Record<TransactionMode, { title: string; verb: string; method: string; done: string }> = {
  deposit: { title: "Deposit", verb: "Post deposit", method: "Received by", done: "Deposit posted" },
  withdrawal: { title: "Withdrawal", verb: "Post withdrawal", method: "Paid out by", done: "Withdrawal posted" },
};

export function TransactionDialog({ mode, account, onOpenChange, onPosted }: TransactionDialogProps) {
  const open = mode !== null;
  const [amountRaw, setAmountRaw] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState<Exclude<SavingsMethod, "savings">>("cash");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, mode)) {
    setAmountRaw("");
    setDate(todayISO());
    setMethod("cash");
    setReference("");
    setRemarks("");
    setSubmitted(false);
  }

  // The product's fee rule, from the server's product, shown before posting.
  // The staff API sends no per-account preview of the month's count.
  const fetchProducts = useCallback(() => savingsService.products(), []);
  const products = useApiResource(fetchProducts, mode === "withdrawal");
  const rule = (products.data?.find((p) => p.id === account.product.id) ?? null) as SavingsWithdrawalRule | null;
  const feeHint = mode === "withdrawal" ? withdrawalFeeRuleHint(rule) : null;

  const amount = parseMoneyInput(amountRaw);
  const amountError = amount.ok ? null : amount.message;
  const dateError = date ? null : "Enter the date.";
  const copy = COPY[mode ?? "deposit"];

  function submit() {
    setSubmitted(true);
    if (!mode || dateError || !amount.ok) return;
    const post = mode === "deposit" ? savingsService.deposit : savingsService.withdraw;
    const body = {
      amount: amount.value,
      date,
      payment_method: method,
      reference: reference.trim() || undefined,
      remarks: remarks.trim() || undefined,
    };
    run((key) => post(account.id, body, key))
      ?.then((result) => {
        // A posted line can be receipted at once; one sent for approval has
        // nothing to receipt until it posts. The toast states the server's
        // figure (the posted line's, or the approval's), never the typed one.
        const posted = result.kind === "posted" && isReceiptTransaction(result.record) ? result.record : null;
        // A withdrawal names its excess-withdrawal fee beside the amount, both the server's.
        const description = posted
          ? posted.type === "withdrawal"
            ? postedWithdrawalText(posted)
            : formatCurrency(receiptAmount(posted))
          : result.kind === "sent_for_approval"
            ? withFeeText(result.approval.amount, feeOf(result.approval))
            : undefined;
        notifySuccess(
          moneyPostMessage(result, copy.done),
          description,
          posted ? { label: "Print receipt", onClick: () => void printSavingsReceipt(account, posted) } : undefined,
        );
        onOpenChange(false);
        onPosted();
      })
      .catch((err: unknown) => notifyError(err, `Couldn't post the ${mode}.`));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {copy.title} · {account.account_number}
          </DialogTitle>
          <DialogDescription>
            {mode === "withdrawal"
              ? `Available to withdraw: ${formatCurrency(account.available_balance)} (after holds, pending requests and the maintaining balance). Above the approval amount, a withdrawal waits for approval.`
              : `Current balance: ${formatCurrency(account.balance)}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="tx-amount" label="Amount" error={submitted ? amountError : null}>
              <Input
                id="tx-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amountRaw}
                onChange={(e) => setAmountRaw(e.target.value)}
                autoFocus
              />
            </FormField>
            <FormField id="tx-date" label="Date" error={submitted ? dateError : null}>
              <Input id="tx-date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="tx-method" label={copy.method}>
              <OptionSelect
                id="tx-method"
                value={method}
                onChange={(v) => setMethod(v as Exclude<SavingsMethod, "savings">)}
                options={PAYMENT_METHOD_OPTIONS}
              />
            </FormField>
            <FormField id="tx-ref" label="Reference (optional)">
              <Input id="tx-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="OR / transfer no." />
            </FormField>
          </div>
          {feeHint && <p className="text-xs text-muted-foreground">{feeHint}</p>}
          <FormField id="tx-remarks" label="Remarks (optional)">
            <Textarea id="tx-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Posting…" : copy.verb}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
