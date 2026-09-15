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
import { toCentavos } from "@/lib/accounting/money";
import { todayISO } from "@/lib/format";
import type { Account } from "@/types";
import { AccountSelect } from "./account-select";

interface TransferPayload {
  date: string;
  from_account_id: number;
  to_account_id: number;
  amount: number;
  charge?: number;
  description: string;
}

interface TransferDialogProps {
  open: boolean;
  accounts: Account[];
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TransferPayload) => void;
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

  const amountCentavos = toCentavos(amount);
  const chargeCentavos = toCentavos(charge);

  // Same account on both sides is a no-op that still writes two lines against
  // one account, which reads as activity that never happened.
  const sameAccount = fromId !== null && fromId === toId;
  const valid =
    fromId !== null &&
    toId !== null &&
    !sameAccount &&
    amountCentavos !== null &&
    amountCentavos > 0 &&
    description.trim().length > 0;

  const submit = () => {
    if (!valid) return;
    onSubmit({
      date,
      from_account_id: fromId,
      to_account_id: toId,
      amount: amountCentavos,
      charge: chargeCentavos ?? undefined,
      description: description.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid}>
            Record transfer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
