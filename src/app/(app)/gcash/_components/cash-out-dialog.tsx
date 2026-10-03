"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { gcashService } from "@/services/gcash.service";
import { useGCashTiers } from "@/hooks/use-gcash-tiers";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import { formatCurrency } from "@/lib/format";
import { gcashPartyNoun, gcashPartyPayload } from "@/lib/gcash-party";
import type { GCashParty } from "@/types";
import { cashOutTotalIssue } from "../_lib/cash-out-total";
import { gcashTierIssue } from "../_lib/tier-issue";
import { GCashTierNotice } from "./gcash-tier-notice";

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
  const {
    tiers,
    resolveCharge,
    loading: tiersLoading,
    error: tiersError,
    refresh: retryTiers,
  } = useGCashTiers();
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount("");
      setRemarks("");
    }
  }, [open]);

  const amountNum = Number(amount);
  const charge = useMemo(
    () =>
      Number.isFinite(amountNum) && amountNum > 0
        ? resolveCharge(amountNum, "cash_out")
        : null,
    [amountNum, resolveCharge],
  );
  const total = charge === null ? null : amountNum - charge;
  const tierIssue = gcashTierIssue({
    loading: tiersLoading,
    error: tiersError,
    tierCount: tiers.length,
    amount: amountNum,
    charge,
  });
  // The one reason Record is disabled that the tier notice doesn't cover.
  const totalIssue = cashOutTotalIssue(charge, total);
  const canSubmit =
    !submitting &&
    amountNum > 0 &&
    charge !== null &&
    total !== null &&
    totalIssue === null &&
    !tiersLoading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const tx = await gcashService.createTransaction({
        ...gcashPartyPayload(party),
        type: "cash_out",
        amount: amountNum,
        remarks: remarks.trim() || undefined,
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
          <div className="space-y-1.5">
            <Label htmlFor="cashout-amount">Amount (₱)</Label>
            <Input
              id="cashout-amount"
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
            issue={tierIssue}
            action="Cash Out"
            amount={amountNum}
            onRetry={() => void retryTiers()}
          />

          {totalIssue && (
            <p role="alert" className="text-sm text-destructive">
              {totalIssue}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-muted-foreground">Charge</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {charge !== null
                  ? formatCurrency(charge)
                  : tierIssue === "out_of_range"
                    ? "No tier"
                    : "—"}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Total</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                {total !== null ? formatCurrency(total) : "—"}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cashout-remarks">Remarks (optional)</Label>
            <Textarea
              id="cashout-remarks"
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
            {submitting ? "Saving…" : "Record Cash Out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
