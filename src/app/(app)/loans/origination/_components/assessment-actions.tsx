"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { notifyError } from "@/lib/notify";
import { saveBlob } from "@/lib/save-blob";
import { loanOriginationService } from "@/services";
import type { Assessment } from "@/types/loan-origination";
import { rerunFormFrom, rerunPayload, type RerunForm } from "../_lib/assessment-view";
import { ActionDialog } from "./action-dialog";

/** Downloads the server-rendered assessment PDF; each download is audited. */
export function AssessmentPdfButton({ assessment }: { assessment: Assessment }) {
  const [busy, setBusy] = useState(false);
  const download = () => {
    setBusy(true);
    loanOriginationService
      .assessmentPdf(assessment.application_id)
      .then((blob) => saveBlob(blob, `assessment-${assessment.reference_number ?? assessment.application_id}-v${assessment.version}.pdf`))
      .catch((err) => notifyError(err, "Could not download the assessment"))
      .then(() => setBusy(false));
  };
  return (
    <Button size="sm" variant="outline" onClick={download} disabled={busy}>
      {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}
      PDF
    </Button>
  );
}

/**
 * What a verified field says, by where it stands against the figure it opened
 * on: kept, cleared (the declared figure counts again) or entered.
 */
function verifiedHint(kind: "income" | "debts", value: string, last: string | null, firstRun: boolean): string {
  const declared = kind === "income" ? "the declared income counts" : "the declared debts count";
  if (firstRun) {
    return kind === "income" ? `From the payslip, ITR or business records. Blank: ${declared}.` : `Blank: ${declared}.`;
  }
  if (last === null) return "Leave blank to keep the last run's figure.";
  const typed = value.trim();
  if (last !== "" && typed === "") return `Cleared: ${declared} again.`;
  if (last !== "" && typed === last.trim()) return "The last run's verified figure. Empty it to clear it.";
  if (last === "" && typed === "") return `Not verified in the last run: ${declared}.`;
  return "Replaces the last run's figure.";
}

/**
 * Runs the assessment on the server with the verified figures staff enter.
 * The fields open on the last run's verified figures (`verified_inputs`):
 * left as they are they're kept, emptied they're cleared (sent as null, so the
 * declared figure counts again), and the start date is today when blank. The
 * server works out every figure and stores a new revision.
 */
export function RunAssessmentDialog({
  applicationId,
  current,
  open,
  onOpenChange,
  onDone,
}: {
  applicationId: number;
  current: Assessment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<RerunForm>(() => rerunFormFrom(current));
  if (useDialogOpening(open, applicationId)) setForm(rerunFormFrom(current));
  const { payload, problems } = rerunPayload(form);
  const set = (patch: Partial<RerunForm>) => setForm((f) => ({ ...f, ...patch }));
  const firstRun = current === null;

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={firstRun ? "Run the assessment" : "Run the assessment again"}
      description="The server works out the income, debts, instalment and limits, and keeps each run as a new version."
      confirmLabel="Run assessment"
      successMessage="Assessment saved"
      errorMessage="Could not run the assessment"
      canConfirm={problems.length === 0}
      onConfirm={() => loanOriginationService.rerunAssessment(applicationId, payload)}
      onDone={onDone}
      size="md"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="verified-income">Verified monthly income</Label>
          <Input
            id="verified-income"
            inputMode="decimal"
            placeholder="Not verified"
            value={form.verifiedIncome}
            onChange={(e) => set({ verifiedIncome: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">{verifiedHint("income", form.verifiedIncome, form.lastIncome, firstRun)}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="verified-debt">Verified monthly debt payments</Label>
          <Input
            id="verified-debt"
            inputMode="decimal"
            placeholder="Not verified"
            value={form.verifiedDebt}
            onChange={(e) => set({ verifiedDebt: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">{verifiedHint("debts", form.verifiedDebt, form.lastDebt, firstRun)}</p>
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Debt payments to other lenders; a linked member&apos;s Lendy loans are added by the server.
        </p>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="assessment-start">Loan start date (optional)</Label>
          <Input id="assessment-start" type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          <p className="text-xs text-muted-foreground">
            Today when blank. Submitting for approval checks the assessment again at the loan&apos;s own start date.
          </p>
        </div>
      </div>
      {problems.length > 0 && (
        <ul className="space-y-0.5 text-sm text-destructive">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </ActionDialog>
  );
}

/** The officer's findings and recommendations, saved as a new version on the same figures. */
export function FindingsDialog({
  assessment,
  open,
  onOpenChange,
  onDone,
}: {
  assessment: Assessment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [findings, setFindings] = useState("");
  const [recommendations, setRecommendations] = useState("");
  if (useDialogOpening(open, assessment.id)) {
    setFindings(assessment.officer_findings ?? "");
    setRecommendations(assessment.recommendations ?? "");
  }
  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Officer findings"
      confirmLabel="Save"
      successMessage="Findings saved"
      errorMessage="Could not save the findings"
      onConfirm={() =>
        loanOriginationService.saveFindings(assessment.application_id, {
          officer_findings: findings.trim() || null,
          recommendations: recommendations.trim() || null,
        })
      }
      onDone={onDone}
      size="md"
    >
      <div className="space-y-1.5">
        <Label htmlFor="officer-findings">Findings</Label>
        <Textarea id="officer-findings" rows={4} maxLength={5000} value={findings} onChange={(e) => setFindings(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="officer-recommendations">Recommendations</Label>
        <Textarea
          id="officer-recommendations"
          rows={3}
          maxLength={5000}
          value={recommendations}
          onChange={(e) => setRecommendations(e.target.value)}
        />
      </div>
    </ActionDialog>
  );
}
