"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { PasswordFields } from "@/components/portal/password-fields";
import { usePasswordRules } from "@/components/portal/portal-config";
import { SectionCard } from "@/components/portal/section-card";
import { useConfirmedSubmit } from "@/lib/portal/hooks/use-confirmed-submit";
import { passwordReady } from "@/lib/portal/password-rules";
import { portalService } from "@/lib/portal/portal-api";
import { CONFIRMS } from "@/lib/portal/server-confirm";

/** Change the password; the server signs out every other device. */
export function ChangePasswordCard({ urgent, onChanged }: { urgent: boolean; onChanged: () => void }) {
  const rules = usePasswordRules();
  const { submitting, submit, fieldErrors, setFieldErrors } = useConfirmedSubmit();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!current) {
      setFieldErrors({ current_password: "Enter your current password." });
      return;
    }
    if (!passwordReady(password, confirmation, rules)) {
      setFieldErrors({ password: "Choose a password that meets every rule, and type it the same way twice." });
      return;
    }
    submit(() => portalService.changePassword(current, password, confirmation), {
      expect: CONFIRMS.done,
      success: "Password changed. Your other devices were signed out.",
      failure: "We couldn't change your password. Please try again.",
      onConfirmed: () => {
        setCurrent("");
        setPassword("");
        setConfirmation("");
        onChanged();
      },
    });
  };

  return (
    <SectionCard title="Change password">
      {urgent && (
        <p role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          You reported a sign-in you don&apos;t recognise. Please choose a new password now.
        </p>
      )}
      <form onSubmit={onSubmit} className="grid max-w-xl gap-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="pw-current">Current password</Label>
          <PasswordInput
            id="pw-current"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            aria-invalid={!!fieldErrors.current_password}
            aria-describedby={fieldErrors.current_password ? "pw-current-error" : undefined}
          />
          {fieldErrors.current_password && (
            <p id="pw-current-error" className="text-xs text-destructive">
              {fieldErrors.current_password}
            </p>
          )}
        </div>
        <PasswordFields
          idPrefix="pw"
          password={password}
          confirmation={confirmation}
          onPassword={setPassword}
          onConfirmation={setConfirmation}
          rules={rules}
          error={fieldErrors.password}
        />
        <div>
          <Button type="submit" disabled={submitting}>
            {submitting && <Spinner className="h-4 w-4" />}
            Change password
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
