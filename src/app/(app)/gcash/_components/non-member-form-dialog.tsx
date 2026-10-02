"use client";

import { useState, type ReactNode } from "react";
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
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDialogOpening } from "@/hooks";
import { gcashService } from "@/services/gcash.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import type { GCashNonMember } from "@/types";
import {
  EMPTY_WALK_IN_FORM,
  WALK_IN_FIELDS,
  WALK_IN_MAX_LENGTH,
  validateWalkInForm,
  walkInFieldErrors,
  walkInFormFrom,
  walkInPayload,
  type WalkInField,
  type WalkInFieldErrors,
  type WalkInFormState,
} from "../_lib/walk-in-form";

const ID_TYPES = [
  "UMID",
  "SSS",
  "PhilSys / National ID",
  "Driver's License",
  "Passport",
  "PhilHealth",
  "Postal ID",
  "Voter's ID",
  "Barangay ID",
  "Other",
] as const;

/** The input each field's error belongs to, and takes focus when it fails. */
const FIELD_IDS: Record<WalkInField, string> = {
  full_name: "nm-name",
  mobile_number: "nm-mobile",
  id_type: "nm-id-type",
  id_number: "nm-id-number",
  remarks: "nm-remarks",
};

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Omit to add a new walk-in; pass one to edit it. */
  nonMember?: GCashNonMember | null;
  /**
   * `saved` is the row the API echoed back, so a caller that opened this to
   * register someone standing at the counter can select them immediately
   * instead of making the teller find the name they just typed. Optional
   * because the response envelope is not guaranteed to carry it; callers that
   * only need to refresh a list ignore the argument.
   */
  onSaved?(saved?: GCashNonMember): void;
}

function FormField({
  field,
  label,
  required = false,
  error,
  children,
}: {
  field: WalkInField;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={FIELD_IDS[field]}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      <FieldError id={`${FIELD_IDS[field]}-error`} className="text-xs">
        {error}
      </FieldError>
    </div>
  );
}

export function NonMemberFormDialog({
  open,
  onOpenChange,
  nonMember,
  onSaved,
}: Props) {
  const [form, setForm] = useState<WalkInFormState>(EMPTY_WALK_IN_FORM);
  const [errors, setErrors] = useState<WalkInFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  if (useDialogOpening(open, nonMember)) {
    setForm(nonMember ? walkInFormFrom(nonMember) : EMPTY_WALK_IN_FORM);
    setErrors({});
  }

  const set = <K extends keyof WalkInFormState>(
    key: K,
    value: WalkInFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // The message was about the old value; editing it is the fix in progress.
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  /** Every attribute an input needs to carry its field's error. */
  const fieldProps = (field: WalkInField) => ({
    id: FIELD_IDS[field],
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `${FIELD_IDS[field]}-error` : undefined,
  });

  const showErrors = (next: WalkInFieldErrors) => {
    setErrors(next);
    const first = WALK_IN_FIELDS.find((field) => next[field]);
    if (first) document.getElementById(FIELD_IDS[first])?.focus();
  };

  const payload = walkInPayload(form);
  // A walk-in has no member record behind them, so the counter needs a name,
  // a reachable number, and a presented ID on every row.
  const canSubmit =
    !submitting &&
    payload.full_name.length > 0 &&
    payload.mobile_number.length > 0 &&
    payload.id_type.length > 0 &&
    payload.id_number.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const invalid = validateWalkInForm(form);
    if (Object.keys(invalid).length > 0) {
      showErrors(invalid);
      return;
    }
    setSubmitting(true);
    try {
      let saved: GCashNonMember | undefined;
      if (nonMember) {
        const updated = await gcashService.updateNonMember(nonMember.id, payload);
        // Keep the selection right even if the reply carries no row.
        saved = updated ?? { ...nonMember, ...payload };
        toast.success(`${payload.full_name} updated.`);
      } else {
        saved = await gcashService.createNonMember(payload);
        toast.success(`${payload.full_name} added.`);
      }
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      const serverErrors = walkInFieldErrors(err);
      if (Object.keys(serverErrors).length > 0) showErrors(serverErrors);
      else toast.error(extractGCashErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{nonMember ? "Edit Walk-in" : "Add Walk-in"}</DialogTitle>
          <DialogDescription>
            A walk-in customer who is not a coop member. Name, mobile number,
            and a presented ID are required — they are the only record you have
            of who transacted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormField
            field="full_name"
            label="Full Name"
            required
            error={errors.full_name}
          >
            <Input
              {...fieldProps("full_name")}
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              maxLength={WALK_IN_MAX_LENGTH.full_name}
              placeholder="Juan Dela Cruz"
              autoFocus
            />
          </FormField>

          <FormField
            field="mobile_number"
            label="Mobile Number"
            required
            error={errors.mobile_number}
          >
            <Input
              {...fieldProps("mobile_number")}
              inputMode="tel"
              value={form.mobile_number}
              onChange={(e) => set("mobile_number", e.target.value)}
              maxLength={WALK_IN_MAX_LENGTH.mobile_number}
              placeholder="09XXXXXXXXX"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              field="id_type"
              label="ID Presented"
              required
              error={errors.id_type}
            >
              <Select
                // `null`, not `undefined`: Base UI reads `undefined` as "this
                // Select is uncontrolled", so an empty id_type made the very
                // first render uncontrolled and picking an ID flipped it to
                // controlled — a React warning on every walk-in registered.
                // `null` is Base UI's controlled empty value and still shows
                // the placeholder.
                value={form.id_type || null}
                onValueChange={(v) => set("id_type", v ?? "")}
              >
                {/* A fixed list, every entry within id_type's 64 characters. */}
                <SelectTrigger {...fieldProps("id_type")} className="w-full">
                  <SelectValue placeholder="Select ID" />
                </SelectTrigger>
                <SelectContent>
                  {ID_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              field="id_number"
              label="ID Number"
              required
              error={errors.id_number}
            >
              <Input
                {...fieldProps("id_number")}
                value={form.id_number}
                onChange={(e) => set("id_number", e.target.value)}
                maxLength={WALK_IN_MAX_LENGTH.id_number}
                placeholder="ID number"
              />
            </FormField>
          </div>

          <FormField
            field="remarks"
            label="Remarks (optional)"
            error={errors.remarks}
          >
            <Textarea
              {...fieldProps("remarks")}
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              maxLength={WALK_IN_MAX_LENGTH.remarks}
              rows={2}
            />
          </FormField>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting
              ? "Saving…"
              : nonMember
                ? "Save Changes"
                : "Add Walk-in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
