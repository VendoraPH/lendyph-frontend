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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { gcashService } from "@/services/gcash.service";
import { useGCashTiers } from "@/hooks/use-gcash-tiers";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import { formatCurrency } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  borrower: { id: number; full_name: string; borrower_code?: string };
  onCreated?(): void;
}

export function CashInDialog({
  open,
  onOpenChange,
  borrower,
  onCreated,
}: Props) {
  const { resolveCharge, loading: tiersLoading } = useGCashTiers();
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
  const canSubmit =
    !submitting && amountNum > 0 && charge !== null && !tiersLoading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const tx = await gcashService.createTransaction({
        borrower_id: borrower.id,
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
          <DialogTitle>Cash In — {borrower.full_name}</DialogTitle>
          <DialogDescription>
            Records a GCash Cash In on behalf of this member. Member pays{" "}
            <span className="font-medium">Amount + Charge</span>.
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
            {amountNum > 0 && charge === null && !tiersLoading && (
              <p className="text-xs text-destructive">
                No tier covers this amount. Update GCash settings.
              </p>
            )}
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
                Member received GCash on credit and owes the cash. Income is
                deferred until you click Paid.
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
