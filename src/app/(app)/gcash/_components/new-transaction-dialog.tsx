"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { gcashService } from "@/services/gcash.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import type { GCashTransactionType } from "@/types";
import { useGCashChargePreview } from "../_hooks/use-gcash-charge-preview";
import { WALK_IN_MAX_LENGTH } from "../_lib/walk-in-form";
import {
  EMPTY_TRANSACTION_FIELDS,
  TransactionFields,
  type TransactionFieldValues,
} from "./transaction-fields";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  onCreated?(): void;
}

/**
 * The single entry point for recording a GCash transaction for someone who is
 * not a member. The teller picks Cash In or Cash Out and the same fields the
 * row-button dialogs have appear in this one form: a typed Name and Number,
 * then Amount, Charge, Total, Pending Payment (Cash In) and Remarks. Nothing is
 * searched or picked from a list.
 *
 * Submit saves the typed name and number as a walk-in, because the backend
 * records a transaction against a saved party, then records the transaction.
 * If recording fails after the walk-in was saved, a retry with the same name
 * and number reuses it instead of saving a second one.
 */
export function NewTransactionDialog({ open, onOpenChange, onCreated }: Props) {
  const [type, setType] = useState<GCashTransactionType | null>(null);

  /**
   * Closing is the reset point, not an effect keyed on `open`. Reopening must
   * not inherit the last transaction's direction or typed values.
   */
  const close = () => {
    setType(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Transaction</DialogTitle>
          <DialogDescription>
            Record a GCash Cash In or Cash Out for a customer who is not a
            member.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Transaction Type</Label>
          <RadioGroup
            value={type ?? ""}
            onValueChange={(v) => setType(v as GCashTransactionType)}
            className="flex gap-6"
          >
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <RadioGroupItem value="cash_in" />
              Cash In
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <RadioGroupItem value="cash_out" />
              Cash Out
            </label>
          </RadioGroup>
        </div>

        {type ? (
          // Keyed on the type so switching direction starts the form fresh and
          // the preview hook always has a type.
          <NewTransactionForm
            key={type}
            type={type}
            onCancel={close}
            onCreated={() => {
              onCreated?.();
              close();
            }}
          />
        ) : (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewTransactionForm({
  type,
  onCancel,
  onCreated,
}: {
  type: GCashTransactionType;
  onCancel(): void;
  onCreated(): void;
}) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [values, setValues] = useState<TransactionFieldValues>(EMPTY_TRANSACTION_FIELDS);
  const [submitting, setSubmitting] = useState(false);
  const savedWalkIn = useRef<{ key: string; id: number } | null>(null);

  const trimmedName = name.trim();
  const trimmedNumber = number.trim();
  const amountNum = Number(values.amount);
  const { view: preview, retry: retryPreview } = useGCashChargePreview(type, amountNum);
  const canSubmit =
    !submitting && !!trimmedName && !!trimmedNumber && preview.status === "ready";
  const action = type === "cash_in" ? "Cash In" : "Cash Out";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const key = `${trimmedName}\u0000${trimmedNumber}`;
      if (savedWalkIn.current?.key !== key) {
        const walkIn = await gcashService.createNonMember({
          full_name: trimmedName,
          mobile_number: trimmedNumber,
        });
        savedWalkIn.current = { key, id: walkIn.id };
      }
      const tx = await gcashService.createTransaction({
        gcash_non_member_id: savedWalkIn.current.id,
        type,
        amount: amountNum,
        ...(type === "cash_in" ? { is_pending: values.isPending } : {}),
        remarks: values.remarks.trim() || undefined,
      });
      toast.success(`${action} recorded. Reference: ${tx?.reference_no ?? "—"}`);
      onCreated();
    } catch (err) {
      toast.error(extractGCashErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="newtx-name">Name</Label>
            <Input
              id="newtx-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={WALK_IN_MAX_LENGTH.full_name}
              autoComplete="off"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newtx-number">Number</Label>
            <Input
              id="newtx-number"
              type="tel"
              inputMode="tel"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              maxLength={WALK_IN_MAX_LENGTH.mobile_number}
              autoComplete="off"
              placeholder="09XX XXX XXXX"
            />
          </div>
        </div>

        <TransactionFields
          type={type}
          values={values}
          onChange={setValues}
          preview={preview}
          onRetryPreview={retryPreview}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? "Saving…" : `Record ${action}`}
        </Button>
      </DialogFooter>
    </>
  );
}
