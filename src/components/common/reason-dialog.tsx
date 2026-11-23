"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { getErrorMessage } from "@/lib/api-error";
import { dialogFinalFocus } from "@/lib/dialog-focus";
import { notifyValidation } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** The longest reason the server keeps (`'reason' => 'max:500'`). */
export const REASON_MAX_LENGTH = 500;

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  /** The field's label: "Reason" unless the action calls it a note. */
  reasonLabel?: string;
  /** False for an optional note (an approval); the reason is required otherwise. */
  reasonRequired?: boolean;
  /** The longest reason its endpoint keeps: REASON_MAX_LENGTH unless it keeps more. */
  maxLength?: number;
  /** A destructive action (suspend, reject) colours its confirm button. */
  destructive?: boolean;
  /** Fields above the reason (a closing date); the caller owns their state. */
  children?: ReactNode;
  /**
   * Where focus goes after a success that removes the button that opened the
   * dialog; otherwise focus returns to that button.
   */
  fallbackFocus?: RefObject<HTMLElement | null>;
  /** Names of the caller's own required fields still empty, checked on confirm. */
  missingFields?: string[];
  /**
   * Resolve to close. Reject to keep the dialog, and the typed reason, open:
   * the server's refusal is shown inside it, in the server's words.
   */
  onConfirm: (reason: string) => Promise<void>;
}

/**
 * Asks for a written reason before an audited action: suspending a branch,
 * moving the main office, asking to close one, rejecting a request. The
 * server's refusal stays in the dialog (announced to screen readers) so the
 * user can read it beside what they typed.
 *
 * Import it by path: `@/components/common` is not tree-shaken.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  reasonLabel = "Reason",
  reasonRequired = true,
  maxLength = REASON_MAX_LENGTH,
  destructive = false,
  children,
  missingFields = [],
  fallbackFocus,
  onConfirm,
}: ReasonDialogProps) {
  const fieldId = useId();
  const errorId = useId();
  const [reason, setReason] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alertRef = useRef<HTMLParagraphElement>(null);
  // Set only in handlers: true once the action succeeded and closed the dialog.
  const succeeded = useRef(false);
  if (useDialogOpening(open, title)) {
    setReason("");
    setRefusal(null);
  }

  // A refusal takes focus, so it is read out and focus never falls to the page.
  useEffect(() => {
    if (refusal) alertRef.current?.focus();
  }, [refusal]);

  function close() {
    succeeded.current = false;
    onOpenChange(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const missing = [...missingFields, ...(reasonRequired && !reason.trim() ? [reasonLabel] : [])];
    if (missing.length > 0) {
      notifyValidation(missing);
      return;
    }
    setBusy(true);
    setRefusal(null);
    const failure = await onConfirm(reason.trim()).then(
      () => null,
      (err: unknown) => getErrorMessage(err, `We couldn't ${confirmLabel.toLowerCase()}. Please try again.`),
    );
    setBusy(false);
    if (failure === null) {
      succeeded.current = true;
      onOpenChange(false);
    } else setRefusal(failure);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && (next ? onOpenChange(true) : close())}>
      <DialogContent
        finalFocus={() => dialogFinalFocus({ succeeded: succeeded.current, fallback: fallbackFocus?.current ?? null })}
      >
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
          <div className="space-y-2">
            <Label htmlFor={fieldId}>
              {reasonLabel}
              {reasonRequired ? <span className="text-destructive"> *</span> : <span className="text-muted-foreground"> (optional)</span>}
            </Label>
            <Textarea
              id={fieldId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={maxLength}
              required={reasonRequired}
              aria-describedby={refusal ? errorId : undefined}
              className="min-h-24"
            />
          </div>
          {refusal && (
            <p
              ref={alertRef}
              id={errorId}
              role="alert"
              tabIndex={-1}
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive outline-none focus-visible:ring-3 focus-visible:ring-destructive/20"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {refusal}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={busy}>
              Cancel
            </Button>
            {/* Stays focusable while busy, so focus never drops to the page. */}
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={busy} focusableWhenDisabled>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
