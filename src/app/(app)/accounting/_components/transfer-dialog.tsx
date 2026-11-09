"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { todayISO } from "@/lib/format";
import type { Account } from "@/types";
import {
  TRANSFER_REFERENCE_MAX,
  buildTransferPayload,
  type TransferPayload,
} from "../_lib/transfer-payload";
import { AccountSelect } from "./account-select";

interface TransferDialogProps {
  open: boolean;
  accounts: Account[];
  onOpenChange: (open: boolean) => void;
  /**
   * Must return the request's promise.
   *
   * `=> void` here discarded it, so the dialog could not tell that a request
   * was in flight and a second click fired a second one. For a transfer that
   * is two real journal entries in the books, and the server cannot dedupe it:
   * `postImmediately()` keys on `(postable_type, postable_id, source)`, and a
   * fund transfer is not raised BY a document — it IS the document, so there
   * is nothing to key on.
   */
  onSubmit: (data: TransferPayload) => Promise<void>;
}

export function TransferDialog({
  open,
  accounts,
  onOpenChange,
  onSubmit,
}: TransferDialogProps) {
  const [date, setDate] = useState(todayISO());
  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [charge, setCharge] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Same account on both sides is a no-op that still writes two lines against
  // one account, which reads as activity that never happened.
  const sameAccount = fromId !== null && fromId === toId;
  const payload = buildTransferPayload({
    date,
    fromId,
    toId,
    amount,
    charge,
    reference,
    description,
  });

  const submit = async () => {
    if (submitting || !payload) return;
    setSubmitting(true);
    try {
      await onSubmit(payload);
    } finally {
      // Whatever the request did, the button has to come back. A rejection
      // that left this true would wedge the dialog with no way out but a
      // reload.
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer between accounts</DialogTitle>
          <DialogDescription>
            An asset-to-asset move. Only the charge, if any, is an expense.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="transfer-date">Date</Label>
            <Input
              id="transfer-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <AccountSelect
            label="From"
            accounts={accounts}
            value={fromId}
            onChange={setFromId}
            className="w-full"
          />
          <AccountSelect
            label="To"
            accounts={accounts}
            value={toId}
            onChange={setToId}
            className="w-full"
          />
          {sameAccount && (
            <p className="text-sm text-destructive">
              Choose two different accounts.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="transfer-amount">Amount</Label>
              <Input
                id="transfer-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="text-right font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transfer-charge">Charge (optional)</Label>
              <Input
                id="transfer-charge"
                value={charge}
                onChange={(e) => setCharge(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="text-right font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transfer-description">Description</Label>
            <Input
              id="transfer-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="GCash to bank sweep"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transfer-reference">Reference (optional)</Label>
            <Input
              id="transfer-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={TRANSFER_REFERENCE_MAX}
              placeholder="Deposit slip or transaction number"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={!payload || submitting}>
            {submitting && <Spinner className="mr-2 h-4 w-4" />}
            {submitting ? "Recording…" : "Record transfer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
