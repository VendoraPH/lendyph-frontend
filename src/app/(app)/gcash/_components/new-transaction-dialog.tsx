"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { usePermission } from "@/hooks";
import type { GCashNonMember, GCashTransactionType } from "@/types";
import { useGCashParties } from "../_hooks/use-gcash-parties";
import {
  combineShortfalls,
  walkInOption,
  type GCashPartyOption,
} from "../_lib/party-options";
import { CashInDialog } from "./cash-in-dialog";
import { CashOutDialog } from "./cash-out-dialog";
import { DeleteWalkInDialog } from "./delete-walk-in-dialog";
import { GCashPartyPicker } from "./gcash-party-picker";
import { NonMemberFormDialog } from "./non-member-form-dialog";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  onCreated?(): void;
}

/** The walk-in form, adding (`nonMember: null`) or editing one. */
type WalkInFormState = { nonMember: GCashNonMember | null } | null;

/**
 * The single entry point for recording a GCash transaction, for either side of
 * the counter: a coop member or a walk-in. It is also where walk-ins are
 * managed: added, and once selected, edited or deleted.
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
  // Adding, editing and deleting walk-ins all need `gcash:transact`.
  const canManageWalkIns = usePermission().can("gcash:transact");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const { members, nonMembers, loading, searching, error, refresh } =
    useGCashParties(debouncedQuery);
  const [selected, setSelected] = useState<GCashPartyOption | null>(null);
  const [type, setType] = useState<GCashTransactionType>("cash_in");
  const [step, setStep] = useState<"party" | "amount">("party");
  const [walkInForm, setWalkInForm] = useState<WalkInFormState>(null);
  const [deleting, setDeleting] = useState<GCashNonMember | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // One list for both sides of the counter, each row tagged Member or Walk-in.
  const options = useMemo(
    () => [...members.options, ...nonMembers.options],
    [members.options, nonMembers.options],
  );
  const shortfall = useMemo(
    () => combineShortfalls(members, nonMembers),
    [members, nonMembers],
  );
  const selectedWalkIn = selected?.nonMember ?? null;

  /**
   * Closing is the reset point, not an effect keyed on `open`. Reopening must
   * not inherit the last transaction's party or direction, and doing that in an
   * effect sets state during render for no reason — every close already passes
   * through here, and a parent that unmounts the dialog instead gets a fresh
   * component anyway.
   */
  const close = () => {
    setQuery("");
    setDebouncedQuery("");
    setSelected(null);
    setType("cash_in");
    setStep("party");
    setWalkInForm(null);
    setDeleting(null);
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
                {canManageWalkIns && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setWalkInForm({ nonMember: null })}
                  >
                    <Plus className="size-4" />
                    Add walk-in
                  </Button>
                )}
              </div>
              <GCashPartyPicker
                id="newtx-party"
                options={options}
                value={selected}
                onChange={setSelected}
                query={query}
                onQueryChange={setQuery}
                noun="names"
                loading={loading}
                searching={searching || query.trim() !== debouncedQuery}
                error={error}
                shortfall={shortfall}
              />
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {selectedWalkIn && canManageWalkIns && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setWalkInForm({ nonMember: selectedWalkIn })}
                  >
                    <Pencil className="size-4" />
                    Edit walk-in
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleting(selectedWalkIn)}
                  >
                    <Trash2 className="size-4" />
                    Delete walk-in
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Number</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {selected?.contactNumber ?? "—"}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              onClick={() => setStep("amount")}
              disabled={!selected || loading}
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {step === "amount" && selected && type === "cash_in" && (
        <CashInDialog
          open
          onOpenChange={(o) => !o && setStep("party")}
          party={selected.party}
          onCreated={finish}
        />
      )}
      {step === "amount" && selected && type === "cash_out" && (
        <CashOutDialog
          open
          onOpenChange={(o) => !o && setStep("party")}
          party={selected.party}
          onCreated={finish}
        />
      )}

      {walkInForm && (
        <NonMemberFormDialog
          open
          onOpenChange={(o) => !o && setWalkInForm(null)}
          nonMember={walkInForm.nonMember}
          onSaved={(saved) => {
            refresh();
            if (saved) setSelected(walkInOption(saved));
          }}
        />
      )}

      {deleting && (
        <DeleteWalkInDialog
          nonMember={deleting}
          onOpenChange={(o) => !o && setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            setSelected(null);
            refresh();
          }}
        />
      )}
    </>
  );
}
