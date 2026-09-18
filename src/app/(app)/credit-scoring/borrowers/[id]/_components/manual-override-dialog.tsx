// src/app/(app)/credit-scoring/borrowers/[id]/_components/manual-override-dialog.tsx

"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { creditScoringService } from "@/services";
import type { CreateCreditDecisionData, CreditDecision } from "@/types/credit-scoring";

const DECISION_OPTIONS: { value: CreditDecision["decision"]; label: string }[] = [
  { value: "approve", label: "Approve" },
  { value: "decline", label: "Decline" },
  { value: "refer", label: "Refer for Review" },
  { value: "hold", label: "Hold" },
];

interface ManualOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  borrowerId: number;
  creditScoreId: number;
  onDecisionRecorded: () => void;
}

export function ManualOverrideDialog({
  open,
  onOpenChange,
  borrowerId,
  creditScoreId,
  onDecisionRecorded,
}: ManualOverrideDialogProps) {
  const [decision, setDecision] = useState<CreditDecision["decision"] | "">("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = decision !== "" && reason.trim().length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    const payload: CreateCreditDecisionData = {
      borrower_id: borrowerId,
      credit_score_id: creditScoreId,
      decision,
      reason: reason.trim(),
      remarks: remarks.trim() || undefined,
    };
    try {
      await creditScoringService.createCreditDecision(payload);
      toast.success("Decision recorded.");
      setDecision("");
      setReason("");
      setRemarks("");
      onOpenChange(false);
      onDecisionRecorded();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 501) {
        toast.error("Not connected yet — decisions cannot be recorded until the backend is live.");
      } else {
        toast.error("Unable to record this decision.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Manual Decision</DialogTitle>
          <DialogDescription>
            This score is a recommendation only. Recording a decision here writes to an
            immutable audit trail and requires a reason.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Decision</Label>
            <Select
              value={decision}
              onValueChange={(v) => setDecision(v as CreditDecision["decision"])}
              items={DECISION_OPTIONS}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a decision" />
              </SelectTrigger>
              <SelectContent>
                {DECISION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Reason (required)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why this decision, given the score and factors above?"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Remarks (optional)</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any additional notes for the audit trail."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Recording…" : "Record Decision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
