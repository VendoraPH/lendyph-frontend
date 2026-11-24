"use client";

import { useId, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { env } from "@/config/env";
import { MEMBER_TYPE_OPTIONS } from "@/constants";
import { useDialogOpening } from "@/hooks";
import { formatDate, todayISO } from "@/lib/format";
import { canonicalMemberNumber } from "@/lib/import-schema";
import { notifyInfo, notifySuccess } from "@/lib/notify";
import { borrowerService } from "@/services";
import type { Borrower } from "@/types";
import {
  latestMembershipDate,
  memberTypeLabel,
  membershipDraft,
  membershipFailure,
  membershipRequest,
  type MembershipDraft,
  type MembershipErrors,
  type MembershipField,
} from "../../_lib/member-membership";

interface MembershipDialogProps {
  borrower: Borrower;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After a save: the member's record as the server answered it. */
  onSaved: (saved: Borrower) => void;
}

/**
 * Edits the membership date, member type and membership number
 * (`PATCH /borrowers/{id}/membership`), sending only what changed. The server
 * holds the number to the members import's rules and refuses one another
 * member holds, naming the number only; each refusal shows under its field.
 * After a 404 (the member outside the caller's branches now) Save stays off.
 */
export function MembershipDialog({ borrower, open, onOpenChange, onSaved }: MembershipDialogProps) {
  const id = useId();
  const [draft, setDraft] = useState<MembershipDraft>(() => membershipDraft(borrower));
  const [errors, setErrors] = useState<MembershipErrors>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [outOfReach, setOutOfReach] = useState(false);
  const [busy, setBusy] = useState(false);
  if (useDialogOpening(open, borrower)) {
    setDraft(membershipDraft(borrower));
    setErrors({});
    setGeneral(null);
    setOutOfReach(false);
  }

  const today = todayISO();
  const ended = borrower.membership_ended_on || null;
  const typed = draft.membership_number.trim();
  const stored = canonicalMemberNumber(typed);

  function set(field: MembershipField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function save() {
    const request = membershipRequest(draft, borrower, today);
    if (!request.ok) {
      setErrors(request.errors);
      return;
    }
    if (!request.changed) {
      notifyInfo("Nothing to save: the membership details are unchanged.");
      onOpenChange(false);
      return;
    }
    setBusy(true);
    setErrors({});
    setGeneral(null);
    try {
      const saved = await borrowerService.updateMembership(borrower.id, request.body);
      notifySuccess("Membership details saved");
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      const failure = membershipFailure(err);
      setErrors(failure.fields);
      setGeneral(failure.general);
      setOutOfReach(failure.outOfReach);
    } finally {
      setBusy(false);
    }
  }

  const describedBy = (field: MembershipField, hint = false) =>
    [hint ? `${id}-${field}-hint` : "", errors[field] ? `${id}-${field}-error` : ""].filter(Boolean).join(" ") ||
    undefined;

  const fieldError = (field: MembershipField) =>
    errors[field] ? (
      <p id={`${id}-${field}-error`} className="text-xs text-destructive" role="alert">
        {errors[field]}
      </p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit membership</DialogTitle>
          <DialogDescription>
            {borrower.full_name}&apos;s membership details, which the CDA reports count. Each change is kept in the
            audit trail.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="space-y-1.5" data-field="membership_date">
            <Label htmlFor={`${id}-membership_date`}>Membership Date</Label>
            <Input
              id={`${id}-membership_date`}
              type="date"
              max={latestMembershipDate(borrower, today)}
              value={draft.membership_date}
              onChange={(event) => set("membership_date", event.target.value)}
              disabled={busy}
              aria-invalid={errors.membership_date ? true : undefined}
              aria-describedby={describedBy("membership_date", ended !== null)}
            />
            {fieldError("membership_date")}
            {ended ? (
              <p id={`${id}-membership_date-hint`} className="text-xs text-muted-foreground">
                This membership ended on {formatDate(ended)}, so the membership date can&apos;t be after that day.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5" data-field="member_type">
            <Label htmlFor={`${id}-member_type`}>Member Type</Label>
            <Select
              value={draft.member_type}
              onValueChange={(next: string | null) => set("member_type", next ?? "")}
              disabled={busy}
            >
              <SelectTrigger
                id={`${id}-member_type`}
                className="w-full"
                aria-invalid={errors.member_type ? true : undefined}
                aria-describedby={describedBy("member_type")}
              >
                <SelectValue>{(value: string) => memberTypeLabel(value)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MEMBER_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError("member_type")}
          </div>

          <div className="space-y-1.5" data-field="membership_number">
            <Label htmlFor={`${id}-membership_number`}>Membership Number</Label>
            <Input
              id={`${id}-membership_number`}
              value={draft.membership_number}
              onChange={(event) => set("membership_number", event.target.value)}
              placeholder={borrower.borrower_code}
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              aria-invalid={errors.membership_number ? true : undefined}
              aria-describedby={describedBy("membership_number", true)}
            />
            {fieldError("membership_number")}
            <p id={`${id}-membership_number-hint`} className="text-xs text-muted-foreground">
              {typed !== "" && stored !== typed ? `It will be saved as ${stored}. ` : ""}
              Numbers are kept in capitals without spaces.
              {env.features.memberPortal ? " The member signs in to the member portal with this number." : ""}
              {` Leave it blank to use the member code, ${borrower.borrower_code}.`}
            </p>
          </div>

          {general ? (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {general}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || outOfReach}
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
