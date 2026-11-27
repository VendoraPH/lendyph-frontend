"use client";

import { Check, Circle, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { passwordHints } from "@/lib/portal/password-rules";
import type { PasswordRules } from "@/lib/portal/types";
import { cn } from "@/lib/utils";

interface PasswordFieldsProps {
  password: string;
  confirmation: string;
  onPassword: (value: string) => void;
  onConfirmation: (value: string) => void;
  rules: PasswordRules;
  /** The server's 422 for `password`, shown beside the field. */
  error?: string;
  label?: string;
  idPrefix: string;
}

/** A new password, its confirmation and the rule as a checklist (carried over from #511 by Augustin). */
export function PasswordFields({ password, confirmation, onPassword, onConfirmation, rules, error, label = "New password", idPrefix }: PasswordFieldsProps) {
  const hints = passwordHints(password, rules);
  const mismatch = confirmation.length > 0 && confirmation !== password;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-password`}>{label}</Label>
        <PasswordInput
          id={`${idPrefix}-password`}
          autoComplete="new-password"
          value={password}
          maxLength={rules.max_length}
          onChange={(e) => onPassword(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={`${idPrefix}-hints${error ? ` ${idPrefix}-error` : ""}`}
        />
        {error && (
          <p id={`${idPrefix}-error`} className="text-xs text-destructive">
            {error}
          </p>
        )}
        <ul id={`${idPrefix}-hints`} className="space-y-1 text-xs">
          {hints.map((hint) => (
            <li
              key={hint.text}
              className={cn("flex items-center gap-1.5", hint.met ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}
            >
              {hint.met === null ? (
                <Info className="h-3.5 w-3.5" aria-hidden />
              ) : hint.met ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Circle className="h-3.5 w-3.5" aria-hidden />
              )}
              <span>
                {hint.text}
                <span className="sr-only">{hint.met === null ? "" : hint.met ? " (done)" : " (not yet)"}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-confirm`}>Type it again</Label>
        <PasswordInput
          id={`${idPrefix}-confirm`}
          autoComplete="new-password"
          value={confirmation}
          maxLength={rules.max_length}
          onChange={(e) => onConfirmation(e.target.value)}
          aria-invalid={mismatch}
          aria-describedby={mismatch ? `${idPrefix}-mismatch` : undefined}
        />
        {mismatch && (
          <p id={`${idPrefix}-mismatch`} className="text-xs text-destructive">
            The two passwords don&apos;t match.
          </p>
        )}
      </div>
    </div>
  );
}
