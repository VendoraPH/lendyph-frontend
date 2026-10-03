"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { gcashService } from "@/services/gcash.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import { nonMemberParty } from "@/lib/gcash-party";
import type { GCashParty, GCashTransactionType } from "@/types";
import { WALK_IN_MAX_LENGTH } from "../_lib/walk-in-form";
import { CashInDialog } from "./cash-in-dialog";
import { CashOutDialog } from "./cash-out-dialog";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  onCreated?(): void;
}

/**
 * The single entry point for recording a GCash transaction for someone who is
 * not a member: the teller picks Cash In or Cash Out, then types their name
 * and number. Nothing is searched or picked from a list.
 *
 * Two steps on purpose. This dialog answers "which way, and for whom", then
 * hands off to the SAME `CashInDialog` / `CashOutDialog` the per-row buttons
 * open, so the amount step cannot diverge between the two entry points.
 *
 * The typed name and number are saved as a walk-in on Continue, because the
 * backend records a transaction against a saved party. Going back and
 * continuing again with the same name and number reuses that walk-in instead of
 * saving a second one.
 */
export function NewTransactionDialog({ open, onOpenChange, onCreated }: Props) {
  const [type, setType] = useState<GCashTransactionType | null>(null);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [step, setStep] = useState<"party" | "amount">("party");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ key: string; party: GCashParty } | null>(
    null,
  );

  const trimmedName = name.trim();
  const trimmedNumber = number.trim();
  const canContinue = !!type && !!trimmedName && !!trimmedNumber && !saving;

  /**
   * Closing is the reset point, not an effect keyed on `open`. Reopening must
   * not inherit the last transaction's party or direction.
   */
  const close = () => {
    setType(null);
    setName("");
    setNumber("");
    setStep("party");
    setSaved(null);
    onOpenChange(false);
  };

  const finish = () => {
    onCreated?.();
    close();
  };

  const handleContinue = async () => {
    if (!canContinue) return;
    const key = `${trimmedName}\u0000${trimmedNumber}`;
    if (saved?.key === key) {
      setStep("amount");
      return;
    }
    setSaving(true);
    try {
      const walkIn = await gcashService.createNonMember({
        full_name: trimmedName,
        mobile_number: trimmedNumber,
      });
      setSaved({ key, party: nonMemberParty(walkIn) });
      setStep("amount");
    } catch (err) {
      toast.error(extractGCashErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open={open && step === "party"}
        onOpenChange={(o) => !o && close()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Transaction</DialogTitle>
            <DialogDescription>
              Record a GCash Cash In or Cash Out for a customer who is not a
              member.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Transaction Type</Label>
              <RadioGroup
                value={type ?? ""}
                onValueChange={(v) => setType(v as GCashTransactionType)}
                className="flex gap-6"
              >
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value="cash_in" />
                  Cash In
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value="cash_out" />
                  Cash Out
                </label>
              </RadioGroup>
            </div>

            {type && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="newtx-name">Name</Label>
                  <Input
                    id="newtx-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={WALK_IN_MAX_LENGTH.full_name}
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newtx-number">Number</Label>
                  <Input
                    id="newtx-number"
                    type="tel"
                    inputMode="tel"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    maxLength={WALK_IN_MAX_LENGTH.mobile_number}
                    autoComplete="off"
                    placeholder="09XX XXX XXXX"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button onClick={handleContinue} disabled={!canContinue}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {step === "amount" && saved && type === "cash_in" && (
        <CashInDialog
          open
          onOpenChange={(o) => !o && setStep("party")}
          party={saved.party}
          onCreated={finish}
        />
      )}
      {step === "amount" && saved && type === "cash_out" && (
        <CashOutDialog
          open
          onOpenChange={(o) => !o && setStep("party")}
          party={saved.party}
          onCreated={finish}
        />
      )}
    </>
  );
}
