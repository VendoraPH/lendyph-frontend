"use client";

import { useEffect, useState } from "react";
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
import { gcashService } from "@/services/gcash.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import { gcashPartyNoun, gcashPartyPayload } from "@/lib/gcash-party";
import type { GCashParty } from "@/types";
import { useGCashChargePreview } from "../_hooks/use-gcash-charge-preview";
import { PartyFields } from "./party-fields";
import {
  EMPTY_TRANSACTION_FIELDS,
  TransactionFields,
  type TransactionFieldValues,
} from "./transaction-fields";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  party: GCashParty;
  onCreated?(): void;
}

export function CashOutDialog({
  open,
  onOpenChange,
  party,
  onCreated,
}: Props) {
  const [values, setValues] = useState<TransactionFieldValues>(EMPTY_TRANSACTION_FIELDS);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setValues(EMPTY_TRANSACTION_FIELDS);
  }, [open]);

  const amountNum = Number(values.amount);
  // The charge and total are the server's preview for this exact amount; the
  // browser never works them out. A Cash Out the charge would take all of is
  // the server's 422, shown as it words it. Recording waits for the preview.
  const { view: preview, retry: retryPreview } = useGCashChargePreview("cash_out", amountNum);
  const canSubmit = !submitting && preview.status === "ready";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const tx = await gcashService.createTransaction({
        ...gcashPartyPayload(party),
        type: "cash_out",
        amount: amountNum,
        remarks: values.remarks.trim() || undefined,
      });
      toast.success(`Cash Out recorded. Reference: ${tx?.reference_no ?? "—"}`);
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(extractGCashErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cash Out — {party.full_name}</DialogTitle>
          <DialogDescription>
            Records a GCash Cash Out on behalf of this {gcashPartyNoun(party)}.
            They receive <span className="font-medium">Amount − Charge</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <PartyFields party={party} />
          <TransactionFields
            type="cash_out"
            values={values}
            onChange={setValues}
            preview={preview}
            onRetryPreview={retryPreview}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Saving…" : "Record Cash Out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
