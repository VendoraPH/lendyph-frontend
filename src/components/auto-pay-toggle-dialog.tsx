"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AxiosError } from "axios";
import { loanService } from "@/services/loan.service";
import type { AutoPaySettings } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface AutoPayToggleDialogProps {
  loanId: number;
  loanAccountNumber?: string | null;
  currentEnabled: boolean;
  currentCbsReference?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (settings: AutoPaySettings) => void;
  /** When true, shows "Skip for Now" instead of "Cancel" and adjusts dialog copy */
  isPostRelease?: boolean;
}

export function AutoPayToggleDialog({
  loanId,
  loanAccountNumber,
  currentEnabled,
  currentCbsReference,
  open,
  onOpenChange,
  onSuccess,
  isPostRelease = false,
}: AutoPayToggleDialogProps) {
  const [enabled, setEnabled] = useState(currentEnabled);
  const [cbsReference, setCbsReference] = useState(currentCbsReference ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEnabled(currentEnabled);
      setCbsReference(currentCbsReference ?? "");
    }
  }, [open, currentEnabled, currentCbsReference]);

  async function handleSave() {
    if (enabled && !cbsReference.trim()) {
      toast.error("CBS Reference No. is required when enabling Auto-Pay.");
      return;
    }
    setSaving(true);
    try {
      const result = await loanService.toggleAutoPay(loanId, {
        enabled,
        cbs_reference: enabled ? cbsReference.trim() : undefined,
      });
      toast.success(enabled ? "Auto-Pay enabled." : "Auto-Pay disabled.");
      onSuccess(result);
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof AxiosError
          ? (err.response?.data?.message ?? err.message)
          : "Failed to update Auto-Pay.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isPostRelease ? "Loan Released Successfully ✓" : "Auto-Pay Settings"}
          </DialogTitle>
          <DialogDescription>
            {isPostRelease
              ? `${loanAccountNumber ? `Loan ${loanAccountNumber} has been released.` : "Loan has been released."} Enable Auto-Pay now or configure it later from the loan detail page.`
              : `Configure Auto-Pay for loan ${loanAccountNumber ?? loanId}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Auto-Pay</p>
              <p className="text-xs text-muted-foreground">
                Include in batch auto-pay runs
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Auto-Pay" />
          </div>

          {enabled && (
            <div className="space-y-1.5">
              <Label htmlFor="auto-pay-cbs-reference">
                CBS Reference No.{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="auto-pay-cbs-reference"
                value={cbsReference}
                onChange={(e) => setCbsReference(e.target.value)}
                placeholder="e.g. CBS-2026-00123"
              />
              <p className="text-xs text-muted-foreground">
                Account or debit reference from your CBS system.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {isPostRelease ? "Skip for Now" : "Cancel"}
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save & Close"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
