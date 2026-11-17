"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { STATUS_LABELS, allowedTransitions } from "@/lib/loan-origination";
import { loanOriginationService } from "@/services";
import type { ApplicationDetail, ApplicationStatus } from "@/types/loan-origination";
import { ActionDialog } from "../../../_components/action-dialog";

interface DialogProps {
  application: ApplicationDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/** Moves the application along; the server re-checks the move and records who made it. */
export function TransitionDialog({ application, open, onOpenChange, onDone }: DialogProps) {
  const options = allowedTransitions(application.status);
  const [to, setTo] = useState<ApplicationStatus | "">("");
  const [note, setNote] = useState("");
  if (useDialogOpening(open, application.id)) {
    setTo(options[0] ?? "");
    setNote("");
  }
  // A rejection always carries its reason; other moves may.
  const needsNote = to === "rejected" || to === "withdrawn";

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change status"
      description={`Currently ${STATUS_LABELS[application.status]}. The change and your note go into the application history.`}
      confirmLabel={to === "rejected" ? "Reject application" : "Change status"}
      destructive={to === "rejected"}
      successMessage="Status changed"
      errorMessage="Could not change the status"
      canConfirm={to !== "" && (!needsNote || note.trim() !== "")}
      onConfirm={() => loanOriginationService.transition(application.id, to as ApplicationStatus, note.trim())}
      onDone={onDone}
    >
      <div className="space-y-1.5">
        <Label htmlFor="transition-to">New status</Label>
        <NativeSelect
          id="transition-to"
          className="w-full"
          value={to}
          onChange={(e) => setTo(e.target.value as ApplicationStatus)}
        >
          {options.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {STATUS_LABELS[s]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="transition-note">{needsNote ? "Reason (required)" : "Note (optional)"}</Label>
        <Textarea id="transition-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </ActionDialog>
  );
}

/** Asks the applicant for more; their status reads "Additional information required". */
export function RequestInfoDialog({ application, open, onOpenChange, onDone }: DialogProps) {
  const [message, setMessage] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  if (useDialogOpening(open, application.id)) {
    setMessage("");
    setTypes([]);
  }
  const toggle = (type: string, on: boolean) =>
    setTypes((t) => (on ? [...t, type] : t.filter((x) => x !== type)));

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Request more information"
      description="The applicant sees this message when they track or reopen the application."
      confirmLabel="Send request"
      successMessage="Request sent to the applicant"
      errorMessage="Could not send the request"
      canConfirm={message.trim() !== ""}
      onConfirm={() => loanOriginationService.requestInformation(application.id, message.trim(), types)}
      onDone={onDone}
      size="md"
    >
      <div className="space-y-1.5">
        <Label htmlFor="request-message">What is needed</Label>
        <Textarea
          id="request-message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="For example: please upload your two most recent payslips."
        />
      </div>
      {application.documents.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Documents to upload again (optional)</legend>
          {application.documents.map((d) => (
            <label key={d.type} className="flex items-center gap-2 text-sm">
              <Checkbox checked={types.includes(d.type)} onCheckedChange={(on) => toggle(d.type, on)} />
              {d.label}
            </label>
          ))}
        </fieldset>
      )}
    </ActionDialog>
  );
}

/** A private staff note; the applicant never sees it. */
export function NoteDialog({ application, open, onOpenChange, onDone }: DialogProps) {
  const [body, setBody] = useState("");
  if (useDialogOpening(open, application.id)) setBody("");

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add an internal note"
      description="Only staff can read notes."
      confirmLabel="Add note"
      successMessage="Note added"
      errorMessage="Could not add the note"
      canConfirm={body.trim() !== ""}
      onConfirm={() => loanOriginationService.addNote(application.id, body.trim())}
      onDone={onDone}
    >
      <Label htmlFor="note-body" className="sr-only">
        Note
      </Label>
      <Textarea id="note-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
    </ActionDialog>
  );
}
