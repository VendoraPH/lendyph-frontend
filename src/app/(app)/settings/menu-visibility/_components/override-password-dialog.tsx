"use client";

import { useId, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { menuVisibilityService } from "@/services/menu-visibility.service";
import { overrideRefusal, takePassword } from "../_lib/menu-visibility-view";

interface OverridePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The override is open until `expiresAt` (ISO 8601). */
  onUnlocked: (expiresAt: string) => void;
  /** The server refused the user outright (403): they lack the permission. */
  onDenied: () => void;
}

/**
 * The administrator override. One password field, never prefilled: the
 * password is read from the field as the request goes out and the field is
 * emptied at once (`takePassword`), so it is kept in no state or storage. The
 * server checks it against its own hash; its words show under the field (a
 * wrong password) or as a message (too many tries, not set up).
 */
export function OverridePasswordDialog({ open, onOpenChange, onUnlocked, onDenied }: OverridePasswordDialogProps) {
  const fieldId = useId();
  const fieldErrorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (useDialogOpening(open, "menu-visibility-override")) {
    setFieldError(null);
    setMessage(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const password = takePassword(inputRef.current);
    if (!password) {
      setFieldError("Enter the administrator password.");
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setFieldError(null);
    setMessage(null);
    const result = await menuVisibilityService.override(password).then(
      (granted) => ({ ok: true as const, expiresAt: granted.expires_at }),
      (err: unknown) => ({ ok: false as const, refusal: overrideRefusal(err) }),
    );
    setBusy(false);
    if (result.ok) {
      onUnlocked(result.expiresAt);
      return;
    }
    if (result.refusal.denied) {
      onDenied();
      return;
    }
    setFieldError(result.refusal.field ?? null);
    setMessage(result.refusal.message ?? null);
    inputRef.current?.focus();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Administrator password
            </DialogTitle>
            <DialogDescription>
              Menu Visibility changes which menus everyone on this deployment sees. Enter the administrator password to
              open it for 15 minutes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={fieldId}>Password</Label>
            <Input
              ref={inputRef}
              id={fieldId}
              name="override-password"
              type="password"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
              disabled={busy}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? fieldErrorId : undefined}
            />
            {fieldError && (
              <p id={fieldErrorId} role="alert" className="text-sm text-destructive">
                {fieldError}
              </p>
            )}
          </div>
          {message && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Spinner className="mr-2 h-4 w-4" />}
              Unlock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
