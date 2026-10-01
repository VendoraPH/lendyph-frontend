"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
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
import { useGCashTiers } from "@/hooks/use-gcash-tiers";
import { usePermission } from "@/hooks";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import { formatCurrency } from "@/lib/format";
import { gcashPartyNoun, gcashPartyPayload } from "@/lib/gcash-party";
import type { GCashParty } from "@/types";

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
  const {
    tiers,
    resolveCharge,
    loading: tiersLoading,
    error: tiersError,
  } = useGCashTiers();
  const canEditTiers = usePermission().can("gcash:settings");
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
  const charge = useMemo(
    () =>
      Number.isFinite(amountNum) && amountNum > 0
        ? resolveCharge(amountNum, "cash_in")
        : null,
    [amountNum, resolveCharge],
  );
  const total = charge === null ? null : amountNum + charge;
  // With no tier at all, no amount can resolve a charge, so the button stays
  // disabled whatever is typed. Say why instead of leaving a silent "—".
  const noTiers = !tiersLoading && !tiersError && tiers.length === 0;
  const canSubmit =
    !submitting && amountNum > 0 && charge !== null && !tiersLoading;

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
          {noTiers && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50/50 p-3 text-sm dark:border-amber-700 dark:bg-amber-900/10">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p>
                No GCash fee tiers are set up, so the charge can&rsquo;t be
                worked out and a Cash In can&rsquo;t be recorded yet.{" "}
                {canEditTiers ? (
                  <Link
                    href="/settings/gcash"
                    className="font-medium underline underline-offset-2"
                  >
                    Add a fee tier in GCash Settings
                  </Link>
                ) : (
                  "Ask an admin to add one in GCash Settings."
                )}
              </p>
            </div>
          )}

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-muted-foreground">Charge</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {charge !== null ? formatCurrency(charge) : "—"}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Total</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                {total !== null ? formatCurrency(total) : "—"}
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
