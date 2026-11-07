"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { notifyError, notifyValidation } from "@/lib/notify";
import { gcashAmountProblem, toAmount } from "@/lib/portal/finance";
import { portalService } from "@/services/portal.service";
import type { PortalLoanDetail } from "@/types/portal";

interface GCashPayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: PortalLoanDetail;
}

/**
 * Starts a GCash checkout for a loan. Nothing is posted to the loan here: the
 * payment is applied only when the gateway confirms it to the backend.
 */
export function GCashPayDialog({ open, onOpenChange, loan }: GCashPayDialogProps) {
  const suggested = toAmount(loan.past_due_amount) || toAmount(loan.next_due_amount);
  const [amount, setAmount] = useState(suggested ? String(suggested) : "");
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    const problem = gcashAmountProblem(value, loan.outstanding_balance);
    if (problem) return notifyValidation([problem]);
    setBusy(true);
    portalService
      .payWithGCash({ loan_id: loan.id, amount: value })
      .then((checkout) => {
        // Only ever leave for an https page the server handed back.
        if (!/^https:\/\//i.test(checkout.checkout_url)) throw new Error("Unexpected checkout address");
        window.location.assign(checkout.checkout_url);
      })
      .catch((err) => {
        setBusy(false);
        notifyError(err, "The GCash payment could not be started. Please try again.");
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Pay with GCash</DialogTitle>
            <DialogDescription>
              {loan.loan_number} · You still owe {formatCurrency(loan.outstanding_balance)}. You will be taken to
              GCash to finish paying, and it shows on your loan once GCash confirms it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="gcash-amount">Amount (₱)</Label>
            <Input
              id="gcash-amount"
              type="number"
              inputMode="decimal"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue to GCash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
