"use client";

import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
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
import { formatCurrency } from "@/lib/format";
import { gcashPartyNoun, gcashPartyPayload } from "@/lib/gcash-party";
import type { GCashParty } from "@/types";
import { useGCashChargePreview } from "../_hooks/use-gcash-charge-preview";
import { GCashTierNotice } from "./gcash-tier-notice";

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

          <GCashTierNotice
            issue={preview.status === "no_tier" ? "out_of_range" : null}
            action="Cash In"
            amount={amountNum}
            onRetry={retryPreview}
          />

          {(preview.status === "error" ||
            preview.status === "invalid" ||
            preview.status === "forbidden") && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="flex-1 space-y-2">
                <p>
                  {preview.status === "error"
                    ? `Couldn’t work out the charge. ${preview.message}`
                    : preview.message}
                </p>
                {preview.status === "error" && (
                  <Button type="button" variant="outline" size="sm" onClick={retryPreview}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                )}
              </div>
            </div>
          )}

          <div
            className="grid grid-cols-2 gap-3"
            aria-live="polite"
            aria-busy={preview.status === "loading"}
          >
            <div>
              <Label className="text-muted-foreground">Charge</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {preview.status === "ready"
                  ? formatCurrency(preview.preview.charge_amount)
                  : preview.status === "loading"
                    ? "Calculating…"
                    : preview.status === "no_tier"
                      ? "No tier"
                      : "—"}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Total</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                {preview.status === "ready"
                  ? formatCurrency(preview.preview.total_amount)
                  : preview.status === "loading"
                    ? "Calculating…"
                    : "—"}
              </div>
            </div>
          </div>

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
