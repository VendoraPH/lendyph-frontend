"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { amlaCaseApi } from "@/lib/amla/case-api";
import { amlaDecisionBody, amlaEvidenceProblem, amlaNoteBody, amlaStrBody, type AmlaDecisionForm } from "@/lib/amla/case-view";
import { DOCUMENT_ACCEPT } from "@/lib/file-validation";
import { todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { AmlaCaseDetail, AmlaReportDetail } from "@/types/amla-cases";
import { CddFormDialog } from "../customers/_components/cdd-form-dialog";

export type CaseDialog = "assign" | "note" | "evidence" | "decision" | "str" | null;

interface Props {
  dialog: CaseDialog;
  record: AmlaCaseDetail;
  userId: number | null;
  /** Whether "no STR" is offered: never to the case's opener or assignee. */
  allowNoStr: boolean;
  onClose: () => void;
  /** A step the server answered with the whole case. */
  onCase: (record: AmlaCaseDetail) => void;
  /** Evidence answers only the file, so the case is read again. */
  onReload: () => void;
  onStr: (report: AmlaReportDetail) => void;
}

/** Every step on a case, one dialog each. The server decides; a refusal shows its words. */
export function CaseDialogs(props: Props) {
  return (
    <>
      <AssignDialog {...props} />
      <NoteDialog {...props} />
      <EvidenceDialog {...props} />
      <DecisionDialog {...props} />
      <StrDialog {...props} />
    </>
  );
}

function AssignDialog({ dialog, record, userId, onClose, onCase }: Props) {
  const { submitting, run } = useSubmitGuard();
  return (
    <CddFormDialog
      open={dialog === "assign"}
      title="Assign this case to you?"
      description="You become the case's investigator, and it reads Investigating. You can't then decide it needs no STR: someone else holding AMLA report approval does."
      submitLabel="Assign to me"
      submitting={submitting}
      error={null}
      onClose={onClose}
      onSubmit={() => {
        if (userId === null) return;
        run(() => amlaCaseApi.assign(record.id, userId))
          ?.then((next) => {
            notifySuccess("Case assigned to you");
            onCase(next);
          })
          .catch((err: unknown) => notifyError(err, "The case couldn't be assigned."));
      }}
    >
      <p className="text-sm">{record.reference}</p>
    </CddFormDialog>
  );
}

function NoteDialog({ dialog, record, onClose, onCase }: Props) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(dialog === "note", record.id)) {
    setBody("");
    setError(null);
  }
  return (
    <CddFormDialog
      open={dialog === "note"}
      title="Add an investigation note"
      description="Kept encrypted with the case. It never reaches the member, the portal or anyone outside AMLA."
      submitLabel="Add note"
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={() => {
        const result = amlaNoteBody(body);
        if ("error" in result) return setError(result.error);
        run(() => amlaCaseApi.note(record.id, result.body))
          ?.then((next) => {
            notifySuccess("Note added");
            onCase(next);
          })
          .catch((err: unknown) => notifyError(err, "The note couldn't be added."));
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="amla-case-note">Note</Label>
        <Textarea id="amla-case-note" rows={6} value={body} maxLength={10000} disabled={submitting} onChange={(e) => {
            setBody(e.target.value);
            setError(null);
          }} />
      </div>
    </CddFormDialog>
  );
}

function EvidenceDialog({ dialog, record, onClose, onReload }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(dialog === "evidence", record.id)) {
    setFile(null);
    setDescription("");
    setError(null);
  }
  return (
    <CddFormDialog
      open={dialog === "evidence"}
      title="Upload evidence"
      description="A picture (JPG or PNG), a PDF or a Word document up to 10 MB. It is kept privately with the case, never on the member's record."
      submitLabel="Upload"
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={() => {
        if (file === null) return setError("Pick the file to upload.");
        const problem = amlaEvidenceProblem(file);
        if (problem) return setError(problem);
        run(() => amlaCaseApi.evidence(record.id, file, description))
          ?.then(() => {
            notifySuccess("Evidence uploaded");
            onReload();
          })
          .catch((err: unknown) => notifyError(err, "The file couldn't be uploaded."));
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="amla-case-file">File</Label>
        <Input id="amla-case-file" type="file" accept={DOCUMENT_ACCEPT} disabled={submitting} onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="amla-case-file-description">Description (optional)</Label>
        <Input id="amla-case-file-description" value={description} maxLength={500} disabled={submitting} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </CddFormDialog>
  );
}

const NO_DECISION: AmlaDecisionForm = { decision: "", reason: "", date: "" };

function DecisionDialog({ dialog, record, allowNoStr, onClose, onCase }: Props) {
  const [form, setForm] = useState(NO_DECISION);
  const [error, setError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(dialog === "decision", record.id)) {
    setForm(allowNoStr ? NO_DECISION : { ...NO_DECISION, decision: "str" });
    setError(null);
  }
  const set = (next: Partial<AmlaDecisionForm>) => {
    setForm({ ...form, ...next });
    setError(null);
  };
  const choices: [AmlaDecisionForm["decision"], string][] = [["str", "Suspicion established: an STR is due"]];
  if (allowNoStr) choices.unshift(["no_str", "No STR: close the case with the reason"]);
  return (
    <CddFormDialog
      open={dialog === "decision"}
      title="Record the decision"
      description="An authorized decision on this case. Nothing is filed by itself: an established suspicion starts the STR deadline (the next working day, to verify)."
      submitLabel="Record decision"
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={() => {
        const result = amlaDecisionBody(form, todayISO());
        if ("error" in result) return setError(result.error);
        run(() => amlaCaseApi.decide(record.id, result.body))
          ?.then((next) => {
            notifySuccess("Decision recorded");
            onCase(next);
          })
          .catch((err: unknown) => notifyError(err, "The decision couldn't be recorded."));
      }}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Decision</legend>
        {choices.map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input type="radio" name="amla-decision" value={value} checked={form.decision === value} disabled={submitting} onChange={() => set({ decision: value })} />
            {label}
          </label>
        ))}
        {!allowNoStr && (
          <p className="text-xs text-muted-foreground">You opened or are investigating this case, so deciding it needs no STR is for someone else.</p>
        )}
      </fieldset>
      {form.decision === "str" && (
        <div className="space-y-1">
          <Label htmlFor="amla-decision-date">Date suspicion was established</Label>
          <Input id="amla-decision-date" type="date" max={todayISO()} value={form.date} disabled={submitting} onChange={(e) => set({ date: e.target.value })} />
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="amla-decision-reason">Reason</Label>
        <Textarea id="amla-decision-reason" rows={5} value={form.reason} maxLength={5000} disabled={submitting} onChange={(e) => set({ reason: e.target.value })} />
      </div>
    </CddFormDialog>
  );
}

function StrDialog({ dialog, record, onClose, onStr }: Props) {
  const [narrative, setNarrative] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(dialog === "str", record.id)) {
    setNarrative("");
    setError(null);
  }
  return (
    <CddFormDialog
      open={dialog === "str"}
      title="Prepare the STR"
      description="Write the chronological narrative. The report's other fields are taken from the case. It then waits for approval by someone else holding AMLA report approval; it is never filed by itself."
      submitLabel="Prepare STR"
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={() => {
        const result = amlaStrBody(narrative);
        if ("error" in result) return setError(result.error);
        run(() => amlaCaseApi.prepareStr(record.id, result.body))
          ?.then((report) => {
            notifySuccess("STR prepared, waiting for approval");
            onStr(report);
          })
          .catch((err: unknown) => notifyError(err, "The STR couldn't be prepared."));
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="amla-str-narrative">Narrative</Label>
        <Textarea id="amla-str-narrative" rows={10} value={narrative} maxLength={20000} disabled={submitting} onChange={(e) => {
            setNarrative(e.target.value);
            setError(null);
          }} />
      </div>
    </CddFormDialog>
  );
}
