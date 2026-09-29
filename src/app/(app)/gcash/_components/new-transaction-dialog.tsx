"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { nonMemberParty } from "@/lib/gcash-party";
import type { GCashParty, GCashTransactionType } from "@/types";
import { useGCashParties } from "../_hooks/use-gcash-parties";
import type { GCashPartyShortfall } from "../_hooks/use-gcash-parties";
import { CashInDialog } from "./cash-in-dialog";
import { CashOutDialog } from "./cash-out-dialog";
import { GCashPartyPicker } from "./gcash-party-picker";
import { NonMemberFormDialog } from "./non-member-form-dialog";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  onCreated?(): void;
}

/**
 * The single entry point for recording a GCash transaction, for either side of
 * the counter: a coop member or a walk-in.
 *
 * Two steps on purpose. This dialog answers "which way, and for whom", then
 * hands off to the SAME `CashInDialog` / `CashOutDialog` the per-row buttons
 * open.
 * Re-implementing the amount step here is what made the fields diverge: the
 * inline version sent neither `is_pending` nor `remarks`, so a Cash In started
 * from this button silently lost the deferred-income flag that the identical
 * Cash In started from a table row kept. Delegating makes divergence
 * impossible rather than merely fixed once.
 */
export function NewTransactionDialog({ open, onOpenChange, onCreated }: Props) {
  const { members, nonMembers, loading, error, refreshNonMembers } =
    useGCashParties();
  const [party, setParty] = useState<GCashParty | null>(null);
  const [type, setType] = useState<GCashTransactionType>("cash_in");
  const [step, setStep] = useState<"party" | "amount">("party");
  const [addingWalkIn, setAddingWalkIn] = useState(false);

  // One searchable list for both sides of the counter — there is no more
  // upfront "who is this for" choice, so a member and a walk-in must be
  // distinguishable by name/kind in the same picker rather than two lists
  // gated behind a radio.
  const options = useMemo(
    () => [...members.options, ...nonMembers.options],
    [members.options, nonMembers.options],
  );
  const shortfall = useMemo<GCashPartyShortfall | null>(() => {
    if (!members.shortfall && !nonMembers.shortfall) return null;
    return {
      shown:
        (members.shortfall?.shown ?? members.options.length) +
        (nonMembers.shortfall?.shown ?? nonMembers.options.length),
      total:
        members.shortfall?.total != null && nonMembers.shortfall?.total != null
          ? members.shortfall.total + nonMembers.shortfall.total
          : null,
    };
  }, [members, nonMembers]);

  const contactNumber = useMemo(() => {
    if (!party) return null;
    return (
      options.find(
        (o) => o.party.kind === party.kind && o.party.id === party.id,
      )?.contactNumber ?? null
    );
  }, [options, party]);

  /**
   * Closing is the reset point, not an effect keyed on `open`. Reopening must
   * not inherit the last transaction's party or direction, and doing that in an
   * effect sets state during render for no reason — every close already passes
   * through here, and a parent that unmounts the dialog instead gets a fresh
   * component anyway.
   */
  const close = () => {
    setParty(null);
    setType("cash_in");
    setStep("party");
    setAddingWalkIn(false);
    onOpenChange(false);
  };

  const finish = () => {
    onCreated?.();
    close();
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
              Record a GCash Cash In or Cash Out for a coop member or a walk-in
              customer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Transaction Type</Label>
              <RadioGroup
                value={type}
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

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="newtx-party">Name</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddingWalkIn(true)}
                >
                  <Plus className="size-4" />
                  Add walk-in
                </Button>
              </div>
              <GCashPartyPicker
                id="newtx-party"
                options={options}
                value={party}
                onChange={setParty}
                noun="names"
                loading={loading}
                disabled={Boolean(error)}
                shortfall={shortfall}
              />
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Number</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {contactNumber ?? "—"}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              onClick={() => setStep("amount")}
              disabled={!party || loading}
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {step === "amount" && party && type === "cash_in" && (
        <CashInDialog
          open
          onOpenChange={(o) => !o && setStep("party")}
          party={party}
          onCreated={finish}
        />
      )}
      {step === "amount" && party && type === "cash_out" && (
        <CashOutDialog
          open
          onOpenChange={(o) => !o && setStep("party")}
          party={party}
          onCreated={finish}
        />
      )}

      {addingWalkIn && (
        <NonMemberFormDialog
          open
          onOpenChange={(o) => !o && setAddingWalkIn(false)}
          onSaved={(saved) => {
            refreshNonMembers();
            if (saved) setParty(nonMemberParty(saved));
          }}
        />
      )}
    </>
  );
}
