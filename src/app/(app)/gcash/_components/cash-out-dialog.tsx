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
import { Textarea } from "@/components/ui/textarea";
import { gcashService } from "@/services/gcash.service";
import { gcashPartyNoun, gcashPartyPayload } from "@/lib/gcash-party";
import type { GCashParty } from "@/types";
import { useGCashChargePreview } from "../_hooks/use-gcash-charge-preview";
import { useWalkInBranch } from "../_hooks/use-walk-in-branch";
import { ChargePreviewPanel } from "./charge-preview-panel";
import { WalkInBranchField } from "./walk-in-branch-field";

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
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const branch = useWalkInBranch(party);

  useEffect(() => {
    if (open) {
      setAmount("");
      setRemarks("");
    }
  }, [open]);

  const amountNum = Number(amount);
  // The charge and total are the server's preview for this exact amount; the
  // browser never works them out. A Cash Out the charge would take all of is
  // the server's 422, shown as it words it. Recording waits for the preview.
  const { view: preview, retry: retryPreview } = useGCashChargePreview("cash_out", amountNum);
  const canSubmit = !submitting && !branch.blocked && preview.status === "ready";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const branchBody = branch.take();
    if (branchBody === null) return;
    setSubmitting(true);
    try {
      const tx = await gcashService.createTransaction({
        ...gcashPartyPayload(party),
        ...branchBody,
        type: "cash_out",
        amount: amountNum,
        remarks: remarks.trim() || undefined,
      });
      toast.success(`Cash Out recorded. Reference: ${tx?.reference_no ?? "—"}`);
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      branch.showFailure(err);
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

          <WalkInBranchField branch={branch} disabled={submitting} />

          <ChargePreviewPanel
            view={preview}
            action="Cash Out"
            amount={amountNum}
            onRetry={retryPreview}
          />

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
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-describedby={branch.blocked ? branch.reasonId : undefined}
          >
            {submitting ? "Saving…" : "Record Cash Out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
