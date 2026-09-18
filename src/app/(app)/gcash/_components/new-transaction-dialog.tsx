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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { nonMemberParty } from "@/lib/gcash-party";
import type { GCashParty, GCashTransactionType } from "@/types";
import { useGCashParties } from "../_hooks/use-gcash-parties";
import { CashInDialog } from "./cash-in-dialog";
import { CashOutDialog } from "./cash-out-dialog";
import { GCashPartyPicker } from "./gcash-party-picker";
import { NonMemberFormDialog } from "./non-member-form-dialog";

type PartyKind = GCashParty["kind"];

/**
 * Base UI resolves `<SelectValue>` labels from `items` or a render prop, NOT
 * from the mounted `<SelectItem>` children — without one of those the trigger
 * shows the raw value, so the teller picks a direction and the box reads
 * "cash_in". Same quirk as the loan-product select on the restructure screen.
 */
const TRANSACTION_TYPES: { value: GCashTransactionType; label: string }[] = [
  { value: "cash_in", label: "Cash In" },
  { value: "cash_out", label: "Cash Out" },
];

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  onCreated?(): void;
}

/**
 * The single entry point for recording a GCash transaction, for either side of
 * the counter: a coop member or a walk-in.
 *
 * Two steps on purpose. This dialog answers "who, and which way", then hands
 * off to the SAME `CashInDialog` / `CashOutDialog` the per-row buttons open.
 * Re-implementing the amount step here is what made the fields diverge: the
 * inline version sent neither `is_pending` nor `remarks`, so a Cash In started
 * from this button silently lost the deferred-income flag that the identical
 * Cash In started from a table row kept. Delegating makes divergence
 * impossible rather than merely fixed once.
 */
export function NewTransactionDialog({ open, onOpenChange, onCreated }: Props) {
  const { members, nonMembers, loading, error, refreshNonMembers } =
    useGCashParties();
  const [kind, setKind] = useState<PartyKind>("member");
  const [party, setParty] = useState<GCashParty | null>(null);
  const [type, setType] = useState<GCashTransactionType>("cash_in");
  const [step, setStep] = useState<"party" | "amount">("party");
  const [addingWalkIn, setAddingWalkIn] = useState(false);

  const isMember = kind === "member";
  const list = isMember ? members : nonMembers;
  const noun = isMember ? "members" : "walk-ins";

  const contactNumber = useMemo(() => {
    if (!party) return null;
    return (
      list.options.find((o) => o.party.id === party.id)?.contactNumber ?? null
    );
  }, [list.options, party]);

  const handleKindChange = (next: PartyKind) => {
    setKind(next);
    // A borrower id means nothing once the picker is showing walk-ins.
    setParty(null);
  };

  /**
   * Closing is the reset point, not an effect keyed on `open`. Reopening must
   * not inherit the last transaction's party or direction, and doing that in an
   * effect sets state during render for no reason — every close already passes
   * through here, and a parent that unmounts the dialog instead gets a fresh
   * component anyway.
   */
  const close = () => {
    setKind("member");
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
              <Label>Who is this for?</Label>
              <RadioGroup
                value={kind}
                onValueChange={(v) => handleKindChange(v as PartyKind)}
                className="flex gap-6"
              >
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value="member" />
                  Member
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value="non_member" />
                  Walk-in (non-member)
                </label>
              </RadioGroup>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="newtx-party">Name</Label>
                {!isMember && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddingWalkIn(true)}
                  >
                    <Plus className="size-4" />
                    Add walk-in
                  </Button>
                )}
              </div>
              <GCashPartyPicker
                id="newtx-party"
                options={list.options}
                value={party}
                onChange={setParty}
                noun={noun}
                loading={loading}
                disabled={Boolean(error)}
                shortfall={list.shortfall}
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

            <div className="space-y-1.5">
              <Label htmlFor="newtx-type">Transaction Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as GCashTransactionType)}
              >
                <SelectTrigger id="newtx-type" className="w-full">
                  <SelectValue>
                    {(value: GCashTransactionType | null) =>
                      TRANSACTION_TYPES.find((t) => t.value === value)?.label ??
                      value
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
