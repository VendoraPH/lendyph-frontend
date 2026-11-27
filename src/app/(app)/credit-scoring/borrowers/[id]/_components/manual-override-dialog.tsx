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
import { getErrorMessage } from "@/lib/api-error";
import { DECISION_LABELS } from "@/lib/credit-scoring/labels";
import type { CreateCreditDecisionData, CreditDecision, CreditDecisionValue } from "@/types/credit-scoring";

const DECISION_OPTIONS = (Object.keys(DECISION_LABELS) as CreditDecisionValue[]).map((value) => ({
  value,
  label: DECISION_LABELS[value],
}));

interface ManualOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  borrowerId: number;
  creditScoreId: number;
  /** Set for a decision on a loan assessment's score; the server requires it there. */
  loanId?: number;
  onDecisionRecorded: () => void;
}

export function ManualOverrideDialog({
  open,
  onOpenChange,
  borrowerId,
  creditScoreId,
  loanId,
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
      ...(loanId !== undefined ? { loan_id: loanId } : {}),
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
      toast.error(getErrorMessage(err, "Unable to record this decision."));
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
            <Label id="decision-label">Decision</Label>
            <Select
              value={decision}
              onValueChange={(v) => setDecision(v as CreditDecision["decision"])}
              items={DECISION_OPTIONS}
            >
              <SelectTrigger className="w-full" aria-labelledby="decision-label">
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
            <Label htmlFor="decision-reason">Reason (required)</Label>
            <Textarea
              id="decision-reason"
              maxLength={255}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why this decision, given the score and factors above?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="decision-remarks">Remarks (optional)</Label>
            <Textarea
              id="decision-remarks"
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
