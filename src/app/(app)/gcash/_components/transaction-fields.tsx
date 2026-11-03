"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GCashTransactionType } from "@/types";
import type { ChargePreviewView } from "../_lib/charge-preview";
import { ChargePreviewPanel } from "./charge-preview-panel";

export interface TransactionFieldValues {
  amount: string;
  isPending: boolean;
  remarks: string;
}

export const EMPTY_TRANSACTION_FIELDS: TransactionFieldValues = {
  amount: "",
  isPending: false,
  remarks: "",
};

interface Props {
  type: GCashTransactionType;
  values: TransactionFieldValues;
  onChange(values: TransactionFieldValues): void;
  /** The server's preview for `values.amount`; the caller owns the hook so it can gate Submit on it. */
  preview: ChargePreviewView;
  onRetryPreview(): void;
}

/**
 * The fields of a GCash Cash In or Cash Out: Amount, the server's Charge and
 * Total, Pending Payment (Cash In only) and Remarks. The row-button dialogs and
 * New Transaction all render this, so the entry points cannot diverge.
 */
export function TransactionFields({
  type,
  values,
  onChange,
  preview,
  onRetryPreview,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="txn-amount">Amount (₱)</Label>
        <Input
          id="txn-amount"
          type="number"
          min={0}
          step="0.01"
          value={values.amount}
          onChange={(e) => onChange({ ...values, amount: e.target.value })}
          placeholder="0.00"
        />
      </div>

      <ChargePreviewPanel
        view={preview}
        action={type === "cash_in" ? "Cash In" : "Cash Out"}
        amount={Number(values.amount)}
        onRetry={onRetryPreview}
      />

      {type === "cash_in" && (
        <div className="flex items-start gap-2">
          <Checkbox
            id="txn-pending"
            checked={values.isPending}
            onCheckedChange={(v) => onChange({ ...values, isPending: v === true })}
          />
          <div className="space-y-1">
            <Label htmlFor="txn-pending" className="font-normal">
              Pending Payment
            </Label>
            <p className="text-xs text-muted-foreground">
              They received GCash on credit and still owe the cash. Income is
              deferred until you click Paid.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="txn-remarks">Remarks (optional)</Label>
        <Textarea
          id="txn-remarks"
          value={values.remarks}
          onChange={(e) => onChange({ ...values, remarks: e.target.value })}
          rows={2}
        />
      </div>
    </div>
  );
}
