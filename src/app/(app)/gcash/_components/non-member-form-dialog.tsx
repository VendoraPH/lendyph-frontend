"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  acknowledgedWalkInPayload,
  hasRequiredWalkInFields,
  possibleDuplicateWarning,
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
  /**
   * The server's name-and-mobile warning for a walk-in without an ID. While
   * set, the dialog asks the teller to confirm before saving anyway.
   */
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(
    null,
  );

  if (useDialogOpening(open, nonMember)) {
    setForm(nonMember ? walkInFormFrom(nonMember) : EMPTY_WALK_IN_FORM);
    setErrors({});
    setDuplicateWarning(null);
  }

  const set = <K extends keyof WalkInFormState>(
    key: K,
    value: WalkInFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // The warning and the message were about the old values; editing them is
    // the fix in progress.
    setDuplicateWarning(null);
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
  // A walk-in has no member record behind them, so the counter needs at least
  // a name and a reachable number. The ID is optional (both fields or neither).
  const canSubmit = !submitting && hasRequiredWalkInFields(payload);

  const handleSubmit = async (acknowledgeDuplicate = false) => {
    if (!canSubmit) return;
    const invalid = validateWalkInForm(form);
    if (Object.keys(invalid).length > 0) {
      showErrors(invalid);
      return;
    }
    const sent = acknowledgeDuplicate
      ? acknowledgedWalkInPayload(payload)
      : payload;
    setSubmitting(true);
    try {
      let saved: GCashNonMember | undefined;
      if (nonMember) {
        const updated = await gcashService.updateNonMember(nonMember.id, sent);
        // Keep the selection right even if the reply carries no row.
        saved = updated ?? { ...nonMember, ...payload };
        toast.success(`${payload.full_name} updated.`);
      } else {
        saved = await gcashService.createNonMember(sent);
        toast.success(`${payload.full_name} added.`);
      }
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      const warning = possibleDuplicateWarning(err);
      const serverErrors = walkInFieldErrors(err);
      if (warning) setDuplicateWarning(warning);
      else if (Object.keys(serverErrors).length > 0) showErrors(serverErrors);
      else toast.error(extractGCashErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const hasIdInput = form.id_type !== "" || form.id_number !== "";
  const clearId = () => {
    set("id_type", "");
    set("id_number", "");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{nonMember ? "Edit Walk-in" : "Add Walk-in"}</DialogTitle>
          <DialogDescription>
            A walk-in customer who is not a coop member. Name and mobile number
            are required. An ID is optional: enter both the ID presented and
            its number, or leave both blank.
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
              label="ID Presented (optional)"
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
              label="ID Number (optional)"
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
          {hasIdInput && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={clearId}
              disabled={submitting}
            >
              Clear ID (no ID presented)
            </Button>
          )}

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

        {duplicateWarning ? (
          <>
            <Alert className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
              <AlertTriangle />
              <AlertTitle>Possible duplicate walk-in</AlertTitle>
              <AlertDescription>{duplicateWarning}</AlertDescription>
            </Alert>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDuplicateWarning(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleSubmit(true)}
                disabled={!canSubmit}
              >
                {submitting ? "Saving…" : "Save anyway"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={() => handleSubmit()} disabled={!canSubmit}>
              {submitting
                ? "Saving…"
                : nonMember
                  ? "Save Changes"
                  : "Add Walk-in"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
