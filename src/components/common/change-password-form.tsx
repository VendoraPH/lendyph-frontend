"use client";

import { useId, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { notifyError, notifySuccess } from "@/lib/notify";
import { authService } from "@/services";

/**
 * The one change-password form.
 *
 * Two screens need it — /settings/profile, where changing your password is a
 * choice, and /change-password, where it is the only thing you are allowed to
 * do — and they must agree on the rules, because the rules are the backend's
 * and a second copy only drifts. Every prop below is chrome; nothing a caller
 * passes can change what is validated or what is sent.
 *
 * Deliberately NOT re-exported from components/common/index.ts. That barrel is
 * not tree-shaken and is imported by nearly every page (see the note at the
 * bottom of it), so a re-export would put this form and the auth service behind
 * it into the shared chunk for all of them. Its two consumers import it
 * directly.
 */

const MIN_PASSWORD_LENGTH = 8;

interface PasswordForm {
  current: string;
  next: string;
  confirm: string;
}

const EMPTY_PASSWORD: PasswordForm = { current: "", next: "", confirm: "" };

export interface ChangePasswordFormProps {
  /** "grid" pairs the new/confirm fields on wide screens; "stacked" is one column. */
  layout?: "grid" | "stacked";
  /** Override when "current" is really the temporary password an admin issued. */
  currentPasswordLabel?: string;
  currentPasswordPlaceholder?: string;
  submitLabel?: string;
  submitVariant?: "default" | "outline";
  submitClassName?: string;
  submitFullWidth?: boolean;
  successMessage?: string;
  autoFocus?: boolean;
  /**
   * Rendered between the fields and the submit button — the slot for whatever
   * the caller needs said immediately before the action is taken, which is
   * where a consequence belongs. Below the button it is a footnote nobody
   * reads until after they have clicked.
   */
  footerNote?: React.ReactNode;
  /**
   * Runs after the API accepts the change. Any throw is reported through the
   * same toast as a failed submit, so a caller that navigates or refetches
   * cannot fail silently and leave the button spinning.
   */
  onSuccess?: () => void | Promise<void>;
}

export function ChangePasswordForm({
  layout = "grid",
  currentPasswordLabel = "Current Password",
  currentPasswordPlaceholder = "Enter current password",
  submitLabel = "Update Password",
  submitVariant = "outline",
  submitClassName,
  submitFullWidth = false,
  successMessage = "Password updated. Other active sessions have been signed out.",
  autoFocus = false,
  footerNote,
  onSuccess,
}: ChangePasswordFormProps) {
  const [form, setForm] = useState<PasswordForm>(EMPTY_PASSWORD);
  const [saving, setSaving] = useState(false);

  // Scoped so two of these on one page cannot collide on an id, which would
  // point both labels at the same input.
  const fieldId = useId();
  const currentId = `${fieldId}-current`;
  const nextId = `${fieldId}-new`;
  const confirmId = `${fieldId}-confirm`;
  const mismatchId = `${fieldId}-mismatch`;

  const update = (field: keyof PasswordForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const mismatch = form.confirm.length > 0 && form.next !== form.confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    // These two go straight to `toast.error`, NOT through `notifyError`.
    // notifyError runs its argument through getErrorMessage, which reads the
    // status off an HTTP error — and a non-error like `null` has no response,
    // which it correctly reads as "no reply from the server" and reports as
    // "You appear to be offline". Right for a dropped request, nonsense for a
    // typo in a confirmation field.
    if (form.next !== form.confirm) {
      toast.error("New password and confirmation do not match");
      return;
    }

    if (form.next.length < MIN_PASSWORD_LENGTH) {
      toast.error(
        `New password must be at least ${MIN_PASSWORD_LENGTH} characters`
      );
      return;
    }

    setSaving(true);
    try {
      await authService.changePassword({
        current_password: form.current,
        new_password: form.next,
        new_password_confirmation: form.confirm,
      });
      notifySuccess(successMessage);
      // Cleared before onSuccess, so a caller that navigates away cannot leave
      // the old and new passwords sitting in React state behind the transition.
      setForm(EMPTY_PASSWORD);
      await onSuccess?.();
    } catch (err) {
      notifyError(err, "We couldn't update your password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const stacked = layout === "stacked";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          !stacked && "sm:grid-cols-2"
        )}
      >
        <div className={cn("space-y-2", !stacked && "sm:col-span-2")}>
          <Label htmlFor={currentId}>{currentPasswordLabel} *</Label>
          <PasswordInput
            id={currentId}
            placeholder={currentPasswordPlaceholder}
            value={form.current}
            onChange={(e) => update("current", e.target.value)}
            required
            autoFocus={autoFocus}
            autoComplete="current-password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={nextId}>New Password *</Label>
          <PasswordInput
            id={nextId}
            placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`}
            value={form.next}
            onChange={(e) => update("next", e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={confirmId}>Confirm New Password *</Label>
          <PasswordInput
            id={confirmId}
            placeholder="Repeat new password"
            value={form.confirm}
            onChange={(e) => update("confirm", e.target.value)}
            required
            autoComplete="new-password"
            aria-invalid={mismatch || undefined}
            aria-describedby={mismatch ? mismatchId : undefined}
          />
        </div>
      </div>

      {/* Announced, not just coloured — the submit button disabling itself is
          otherwise the only feedback a screen reader user gets. */}
      {mismatch && (
        <p id={mismatchId} role="alert" className="text-xs text-destructive">
          Passwords do not match.
        </p>
      )}

      {footerNote}

      <div className={cn("flex", submitFullWidth ? "flex-col" : "justify-end")}>
        <Button
          type="submit"
          variant={submitVariant}
          disabled={saving || !form.current || !form.next || mismatch || !form.confirm}
          className={cn(
            submitFullWidth ? "w-full" : "w-full sm:w-auto",
            submitClassName
          )}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? "Updating…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
