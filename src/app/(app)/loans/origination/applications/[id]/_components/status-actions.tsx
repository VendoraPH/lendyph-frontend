"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useApiResource } from "@/hooks";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { STATUS_LABELS } from "@/lib/loan-origination";
import { loanOriginationService } from "@/services";
import type { ApplicationDetail, ApplicationStatus } from "@/types/loan-origination";
import { ActionDialog } from "../../../_components/action-dialog";
import { requestableDocumentTypes, transitionNeedsNote, transitionPayload } from "../../../_lib/application-view";

export interface ApplicationDialogProps {
  application: ApplicationDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  onFailed: (err: unknown) => void;
}

/** Nothing reaches an applicant yet: messages are recorded, and tracking shows them. */
const LOGGED_NOT_SENT = "Logged, not sent: text messages and email aren't switched on yet. The applicant sees it when they track the application.";

/**
 * Moves the application to one of the server's `allowed_transitions`. The
 * internal note stays in the history; the message for the applicant is kept
 * apart, and on a rejection or withdrawal it is the decision notice.
 */
export function TransitionDialog({ application, open, onOpenChange, onDone, onFailed }: ApplicationDialogProps) {
  const options = application.allowed_transitions;
  const [to, setTo] = useState<ApplicationStatus | "">("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  if (useDialogOpening(open, application.id)) {
    setTo(options[0] ?? "");
    setNote("");
    setMessage("");
  }
  const needsNote = to !== "" && transitionNeedsNote(to);
  const decision = to === "rejected" || to === "withdrawn";

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change status"
      description={`Currently ${application.status_label}. The change and your note go into the application history.`}
      confirmLabel={to === "rejected" ? "Reject application" : to === "withdrawn" ? "Withdraw application" : "Change status"}
      destructive={decision}
      successMessage="Status changed"
      errorMessage="Could not change the status"
      canConfirm={to !== "" && (!needsNote || note.trim() !== "")}
      onConfirm={() =>
        loanOriginationService.transition(application.id, transitionPayload(to as ApplicationStatus, application.version, note, message))
      }
      onDone={onDone}
      onFailed={onFailed}
      size="md"
    >
      <div className="space-y-1.5">
        <Label htmlFor="transition-to">New status</Label>
        <NativeSelect id="transition-to" className="w-full" value={to} onChange={(e) => setTo(e.target.value as ApplicationStatus)}>
          {options.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {STATUS_LABELS[s]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="transition-note">{needsNote ? "Internal note (required)" : "Internal note (optional)"}</Label>
        <Textarea id="transition-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="text-xs text-muted-foreground">Staff only. The applicant never sees it.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="transition-message">{decision ? "Decision notice for the applicant (optional)" : "Message to the applicant (optional)"}</Label>
        <Textarea id="transition-message" rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
        <p className="text-xs text-muted-foreground">{LOGGED_NOT_SENT}</p>
      </div>
    </ActionDialog>
  );
}

/**
 * Asks the applicant for more; the application reads Additional Information
 * Required. Any document type in the module's settings can be asked for, the
 * ones the applicant hasn't handed in included; each says where the
 * application's own copy stands.
 */
export function RequestInfoDialog({ application, open, onOpenChange, onDone, onFailed }: ApplicationDialogProps) {
  const [message, setMessage] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  if (useDialogOpening(open, application.id)) {
    setMessage("");
    setTypes([]);
  }
  const settings = useApiResource(loanOriginationService.getSettings, open);
  const offered = settings.data ? requestableDocumentTypes(settings.data.documents.types, application.documents) : [];
  const toggle = (type: string, on: boolean) => setTypes((t) => (on ? [...t, type] : t.filter((x) => x !== type)));

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Request more information"
      description={LOGGED_NOT_SENT}
      confirmLabel="Save request"
      successMessage="Request saved: logged, not sent"
      errorMessage="Could not save the request"
      canConfirm={message.trim() !== ""}
      onConfirm={() =>
        loanOriginationService.requestInformation(application.id, {
          message: message.trim(),
          document_types: types,
          version: application.version,
        })
      }
      onDone={onDone}
      onFailed={onFailed}
      size="md"
    >
      <div className="space-y-1.5">
        <Label htmlFor="request-message">What is needed</Label>
        <Textarea
          id="request-message"
          rows={4}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="For example: please upload your two most recent payslips."
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Documents to ask for (optional)</legend>
        {settings.loading ? (
          <p className="text-sm text-muted-foreground">Loading the document types…</p>
        ) : settings.data === null ? (
          <p className="text-sm text-muted-foreground">The document types couldn&apos;t be loaded. The message can still be saved.</p>
        ) : offered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No document types are set up in the online application settings.</p>
        ) : (
          offered.map((d) => (
            <label key={d.type} className="flex items-center gap-2 text-sm">
              <Checkbox checked={types.includes(d.type)} onCheckedChange={(on) => toggle(d.type, on)} />
              {d.label}
              <span className="text-xs text-muted-foreground">{d.status ?? "Not handed in"}</span>
            </label>
          ))
        )}
      </fieldset>
    </ActionDialog>
  );
}

/** A private staff note; the applicant never sees it. */
export function NoteDialog({ application, open, onOpenChange, onDone, onFailed }: ApplicationDialogProps) {
  const [body, setBody] = useState("");
  if (useDialogOpening(open, application.id)) setBody("");

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add an internal note"
      description="Only staff can read notes. A note is permanent."
      confirmLabel="Add note"
      successMessage="Note added"
      errorMessage="Could not add the note"
      canConfirm={body.trim() !== ""}
      onConfirm={() => loanOriginationService.addNote(application.id, body.trim())}
      onDone={onDone}
      onFailed={onFailed}
    >
      <Label htmlFor="note-body" className="sr-only">
        Note
      </Label>
      <Textarea id="note-body" rows={4} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
    </ActionDialog>
  );
}
