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
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatCurrency, formatDateLong, todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { savingsService } from "@/services";
import type { SavingsAccount } from "@/types";
import type { ShareCapitalTransferInput } from "@/types/savings-servicing";
import { FormField } from "../../../_components/field";
import { buildShareCapitalTransferBody, shareCapitalTransferOutcome } from "../_lib/share-capital-transfer";

interface ShareCapitalTransferDialogProps {
  open: boolean;
  account: SavingsAccount;
  onOpenChange: (open: boolean) => void;
  onPosted: () => void;
}

/**
 * Move savings into the member's share capital (gap round S3). Dated today,
 * through the approval tiers like a withdrawal: up to the first tier it posts
 * at once, above it the amount is reserved until a checker approves it. It
 * can't be reversed, so the form asks for a review first.
 */
export function ShareCapitalTransferDialog({ open, account, onOpenChange, onPosted }: ShareCapitalTransferDialogProps) {
  const [amountRaw, setAmountRaw] = useState("");
  const [remarks, setRemarks] = useState("");
  const [reviewing, setReviewing] = useState<ShareCapitalTransferInput | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, account.id)) {
    setAmountRaw("");
    setRemarks("");
    setReviewing(null);
    setSubmitted(false);
  }

  const check = buildShareCapitalTransferBody(amountRaw, remarks);
  const error = submitted && !check.ok ? check.message : null;

  function review() {
    setSubmitted(true);
    if (check.ok) setReviewing(check.body);
  }

  function submit() {
    if (!reviewing) return;
    run((key) => savingsService.shareCapitalTransfer(account.id, reviewing, key))
      ?.then((result) => {
        const outcome = shareCapitalTransferOutcome(result);
        notifySuccess(outcome.title, outcome.description);
        onOpenChange(false);
        onPosted();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't transfer to share capital."));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer {account.account_number} to share capital</DialogTitle>
          <DialogDescription>
            Into {account.borrower_name ?? "the member"}&apos;s share capital, dated today. Available to transfer:{" "}
            {formatCurrency(account.available_balance)}.
          </DialogDescription>
        </DialogHeader>

        {reviewing ? (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border p-3 text-sm">
              <dt className="text-muted-foreground">From</dt>
              <dd className="font-mono">{account.account_number}</dd>
              <dt className="text-muted-foreground">To</dt>
              <dd>Share capital</dd>
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="font-semibold tabular-nums">{formatCurrency(reviewing.amount)}</dd>
              <dt className="text-muted-foreground">Date</dt>
              <dd>{formatDateLong(todayISO())}</dd>
            </dl>
            <p className="text-xs text-muted-foreground">
              A transfer to share capital can&apos;t be reversed. Above the first approval tier it waits for a checker.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <FormField id="sct-amount" label="Amount" error={error}>
              <Input
                id="sct-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amountRaw}
                onChange={(e) => setAmountRaw(e.target.value)}
                aria-invalid={error ? true : undefined}
              />
            </FormField>
            <FormField id="sct-remarks" label="Remarks (optional)">
              <Textarea
                id="sct-remarks"
                value={remarks}
                maxLength={500}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
              />
            </FormField>
          </div>
        )}

        <DialogFooter>
          {reviewing ? (
            <>
              <Button variant="outline" onClick={() => setReviewing(null)} disabled={submitting}>
                Back
              </Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? "Transferring…" : "Transfer"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={review}>Review transfer</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
