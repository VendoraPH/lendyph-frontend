"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";

export interface DecisionOption<D extends string> {
  value: D;
  label: string;
}

interface DecisionDialogProps<D extends string> {
  /** The record being decided; null closes the dialog. */
  subject: { id: number; reference: string } | null;
  options: DecisionOption<D>[];
  needsResponse: (decision: D) => boolean;
  submit: (id: number, decision: D, response: string) => Promise<unknown>;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  /** What the request asks for, shown above the decision. */
  children?: React.ReactNode;
}

/** Pick a decision and, where the member must be told why, write the reply. */
export function DecisionDialog<D extends string>({
  subject,
  options,
  needsResponse,
  submit,
  onOpenChange,
  onDone,
  children,
}: DecisionDialogProps<D>) {
  const open = subject !== null;
  const [decision, setDecision] = useState<D | "">("");
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);

  if (useDialogOpening(open, subject)) {
    setDecision(options[0]?.value ?? "");
    setResponse("");
  }

  const responseRequired = decision !== "" && needsResponse(decision);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || decision === "") return notifyValidation(["Decision"]);
    if (responseRequired && !response.trim()) return notifyValidation(["Reply to the member"]);
    setBusy(true);
    submit(subject.id, decision, response.trim())
      .then(() => {
        notifySuccess(`${subject.reference} updated`);
        onOpenChange(false);
        onDone();
      })
      .catch((err) => notifyError(err, "The decision could not be saved."))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Decide {subject?.reference}</DialogTitle>
          <DialogDescription>The member is notified and sees your reply in the portal.</DialogDescription>
        </DialogHeader>
        {children}
        <form id="portal-decision" className="space-y-4" onSubmit={save}>
          <div className="space-y-1.5">
            <Label htmlFor="decision">Decision</Label>
            <NativeSelect id="decision" value={decision} onChange={(e) => setDecision(e.target.value as D)}>
              {options.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="decision-response">
              Reply to the member{responseRequired ? "" : " (optional)"}
            </Label>
            <Textarea
              id="decision-response"
              rows={3}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder={responseRequired ? "Say what is missing or why it was not approved." : undefined}
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="portal-decision" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save decision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
