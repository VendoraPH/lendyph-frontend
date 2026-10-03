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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { gcashService } from "@/services/gcash.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import { gcashPartyNoun, gcashPartyPayload } from "@/lib/gcash-party";
import type { GCashParty } from "@/types";
import { useGCashChargePreview } from "../_hooks/use-gcash-charge-preview";
import { ChargePreviewPanel } from "./charge-preview-panel";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  party: GCashParty;
  onCreated?(): void;
}

export function CashInDialog({
  open,
  onOpenChange,
  party,
  onCreated,
}: Props) {
  const [amount, setAmount] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount("");
      setIsPending(false);
      setRemarks("");
    }
  }, [open]);

  const amountNum = Number(amount);
  // The charge and total are the server's preview for this exact amount; the
  // browser never works them out. Recording waits until that preview is in.
  const { view: preview, retry: retryPreview } = useGCashChargePreview("cash_in", amountNum);
  const canSubmit = !submitting && preview.status === "ready";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const tx = await gcashService.createTransaction({
        ...gcashPartyPayload(party),
        type: "cash_in",
        amount: amountNum,
        is_pending: isPending,
        remarks: remarks.trim() || undefined,
      });
      toast.success(`Cash In recorded. Reference: ${tx?.reference_no ?? "—"}`);
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
          <DialogTitle>Cash In — {party.full_name}</DialogTitle>
          <DialogDescription>
            Records a GCash Cash In on behalf of this {gcashPartyNoun(party)}.
            They pay <span className="font-medium">Amount + Charge</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cashin-amount">Amount (₱)</Label>
            <Input
              id="cashin-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>

          <ChargePreviewPanel
            view={preview}
            action="Cash In"
            amount={amountNum}
            onRetry={retryPreview}
          />

          <div className="flex items-start gap-2">
            <Checkbox
              id="cashin-pending"
              checked={isPending}
              onCheckedChange={(v) => setIsPending(v === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="cashin-pending" className="font-normal">
                Pending Payment
              </Label>
              <p className="text-xs text-muted-foreground">
                They received GCash on credit and still owe the cash. Income
                is deferred until you click Paid.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cashin-remarks">Remarks (optional)</Label>
            <Textarea
              id="cashin-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
            />
          </div>
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
            {submitting ? "Saving…" : "Record Cash In"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
