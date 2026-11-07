"use client";

import { Check, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { checkPassword } from "@/lib/portal/password-rules";
import type { PasswordRules } from "@/types/portal";

interface NewPasswordFieldsProps {
  rules: PasswordRules;
  password: string;
  confirmation: string;
  onPassword: (value: string) => void;
  onConfirmation: (value: string) => void;
}

/** New password and its confirmation, with a live checklist of the cooperative's rules. */
export function NewPasswordFields({
  rules,
  password,
  confirmation,
  onPassword,
  onConfirmation,
}: NewPasswordFieldsProps) {
  const checks = checkPassword(password, rules);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          aria-describedby="password-rules"
        />
        <ul id="password-rules" className="space-y-1 text-xs">
          {checks.map((c) => (
            <li
              key={c.label}
              className={
                c.met
                  ? "flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400"
                  : "flex items-center gap-1.5 text-muted-foreground"
              }
            >
              {c.met ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
              {c.label}
              <span className="sr-only">{c.met ? "(done)" : "(not yet)"}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <PasswordInput
          id="confirm-password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => onConfirmation(e.target.value)}
        />
        {confirmation && confirmation !== password && (
          <p className="text-xs text-destructive">The two passwords do not match.</p>
        )}
      </div>
    </div>
  );
}
