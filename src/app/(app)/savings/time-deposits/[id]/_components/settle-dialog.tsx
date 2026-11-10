"use client";

import { useState } from "react";
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
import { useDialogOpening } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { moneyPostMessage } from "@/lib/savings/money-post";
import { timeDepositService } from "@/services";
import type { MaturityInstruction, SavingsMethod, TimeDeposit } from "@/types";
import { FormField } from "../../../_components/field";
import { OptionSelect } from "../../../_components/option-select";
import { PAYMENT_METHOD_OPTIONS } from "../../../_lib/savings-rules";
import { MATURITY_INSTRUCTION_OPTIONS } from "../../../_lib/time-deposit-rules";

interface SettleDialogProps {
  open: boolean;
  deposit: TimeDeposit;
  onOpenChange: (open: boolean) => void;
  /** Called with what the server posted (this placement, or the new one on a rollover), or null when it waits for approval. */
  onSettled: (next: TimeDeposit | null) => void;
}

export function SettleDialog({ open, deposit, onOpenChange, onSettled }: SettleDialogProps) {
  const [date, setDate] = useState("");
  const [action, setAction] = useState<MaturityInstruction>(deposit.maturity_instruction);
  const [method, setMethod] = useState<Exclude<SavingsMethod, "savings">>("cash");
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, deposit)) {
    setDate(todayISO());
    setAction(deposit.maturity_instruction);
    setMethod("cash");
  }

  const tooEarly = date !== "" && date < deposit.maturity_date;
  const paysOut = action !== "rollover_all";

  function submit() {
    if (!date || tooEarly) return;
    const body = { date, action, payout_method: method };
    run((key) => timeDepositService.settle(deposit.id, body, key))
      ?.then((result) => {
        const next = result.kind === "posted" ? result.record : null;
        notifySuccess(
          moneyPostMessage(result, action === "payout" ? "Time deposit paid out" : "Time deposit rolled over"),
          next && next.id !== deposit.id ? `New certificate ${next.certificate_number}` : deposit.certificate_number,
        );
        onOpenChange(false);
        onSettled(next);
      })
      .catch((err: unknown) => notifyError(err, "Couldn't settle the time deposit."));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settle {deposit.certificate_number}</DialogTitle>
          <DialogDescription>
            Matured {formatDate(deposit.maturity_date)} with {formatCurrency(deposit.maturity_amount)} due. A rollover
            opens a new placement at the rate in force on the maturity date and links the two. Above the approval
            amount, a payout waits for approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormField id="st-action" label="Action" hint="Defaults to the instruction given at placement.">
            <OptionSelect id="st-action" value={action} onChange={(v) => setAction(v as MaturityInstruction)} options={MATURITY_INSTRUCTION_OPTIONS} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="st-date" label="Settlement date" error={tooEarly ? "This is before the maturity date; pre-terminate instead." : null}>
              <Input id="st-date" type="date" value={date} min={deposit.maturity_date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
            </FormField>
            {paysOut && (
              <FormField id="st-method" label="Paid out by">
                <OptionSelect
                  id="st-method"
                  value={method}
                  onChange={(v) => setMethod(v as Exclude<SavingsMethod, "savings">)}
                  options={PAYMENT_METHOD_OPTIONS}
                />
              </FormField>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || !date || tooEarly}>
            {submitting ? "Settling…" : "Settle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
