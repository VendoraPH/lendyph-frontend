"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { amlaReasonError } from "@/lib/amla/settings-view";
import { notifyError, notifySuccess } from "@/lib/notify";

export interface AmlaNoteAction {
  title: string;
  description: string;
  /** "Reason" for a new request, "Note" for a decision. */
  label: string;
  required: boolean;
  confirmLabel: string;
  destructive?: boolean;
  success: string;
  failure: string;
  run: (text: string) => Promise<unknown>;
}

/**
 * One text box and a confirm button, for every AMLA step that takes only a
 * reason or a note: approve, reject or withdraw a change, remove a calendar
 * day, confirm a calendar year. The server decides; a refusal shows its words.
 */
export function AmlaNoteDialog({ action, onClose, onDone }: { action: AmlaNoteAction | null; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();

  if (useDialogOpening(action !== null, action)) {
    setText("");
    setError(null);
  }

  function confirm() {
    if (!action) return;
    const problem = action.required || text.trim() !== "" ? amlaReasonError(text) : null;
    if (problem) {
      setError(action.required && text.trim() === "" ? `Give the ${action.label.toLowerCase()}.` : problem);
      return;
    }
    run(() => action.run(text))
      ?.then(() => {
        notifySuccess(action.success);
        onDone();
      })
      .catch((err: unknown) => notifyError(err, action.failure));
  }

  return (
    <Dialog open={action !== null} onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action?.title}</DialogTitle>
          <DialogDescription>{action?.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="amla-note">
            {action?.label}
            {action && !action.required && <span className="text-muted-foreground"> (optional)</span>}
          </Label>
          <Textarea
            id="amla-note"
            value={text}
            maxLength={1000}
            aria-invalid={error !== null}
            aria-describedby={error ? "amla-note-error" : undefined}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
          />
          {error && (
            <p id="amla-note-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant={action?.destructive ? "destructive" : "default"} onClick={confirm} disabled={submitting}>
            {submitting && <Spinner className="mr-2 h-4 w-4" />}
            {action?.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
