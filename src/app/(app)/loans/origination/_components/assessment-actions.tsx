"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { formatCurrency } from "@/lib/format";
import { notifyError } from "@/lib/notify";
import { saveBlob } from "@/lib/save-blob";
import { loanOriginationService } from "@/services";
import type { Assessment } from "@/types/loan-origination";
import { rerunPayload, type RerunForm } from "../_lib/assessment-view";
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

const EMPTY: RerunForm = { verifiedIncome: "", clearIncome: false, verifiedDebt: "", clearDebt: false, startDate: "" };

/**
 * One verified figure: blank keeps the last run's, a figure replaces it, and
 * "Clear" sends null, which the server reads as not verified (the declared
 * figure counts again). Clearing is offered once there is a last run.
 */
function VerifiedField({
  id,
  label,
  placeholder,
  value,
  cleared,
  canClear,
  hint,
  onValue,
  onClear,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  cleared: boolean;
  canClear: boolean;
  hint: string;
  onValue: (value: string) => void;
  onClear: (cleared: boolean) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        placeholder={cleared ? "Not verified" : placeholder}
        disabled={cleared}
        value={cleared ? "" : value}
        onChange={(e) => onValue(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">{cleared ? "Cleared: the declared figure counts." : hint}</p>
      {canClear && (
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={cleared} onCheckedChange={(on) => onClear(on)} />
          Clear the verified figure
        </label>
      )}
    </div>
  );
}

/**
 * Runs the assessment on the server with the verified figures staff enter.
 * A figure left blank keeps the last run's, a cleared one counts the declared
 * figure again, and the start date is today when blank. The server works out
 * every figure and stores a new revision.
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
  const [form, setForm] = useState<RerunForm>(EMPTY);
  if (useDialogOpening(open, applicationId)) setForm(EMPTY);
  const { payload, problems } = rerunPayload(form);
  const set = (patch: Partial<RerunForm>) => setForm((f) => ({ ...f, ...patch }));
  const verifiedIncome = current?.figures.verified_monthly_income ?? null;
  const rerun = current !== null;

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={rerun ? "Run the assessment again" : "Run the assessment"}
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
        <VerifiedField
          id="verified-income"
          label="Verified monthly income"
          placeholder="25000"
          value={form.verifiedIncome}
          cleared={form.clearIncome}
          canClear={rerun && verifiedIncome !== null}
          hint={
            !rerun
              ? "From the payslip, ITR or business records. Blank: the declared income counts."
              : verifiedIncome === null
                ? "Leave blank to keep the last run's figure: not entered."
                : `Leave blank to keep the last run's figure: ${formatCurrency(verifiedIncome)}.`
          }
          onValue={(verifiedIncome) => set({ verifiedIncome })}
          onClear={(clearIncome) => set({ clearIncome })}
        />
        <VerifiedField
          id="verified-debt"
          label="Verified monthly debt payments"
          placeholder="3500"
          value={form.verifiedDebt}
          cleared={form.clearDebt}
          canClear={rerun}
          hint={
            !rerun
              ? "Payments to other lenders. Blank: the declared debts count."
              : "Leave blank to keep the last run's figure. A linked member's Lendy loans are added by the server."
          }
          onValue={(verifiedDebt) => set({ verifiedDebt })}
          onClear={(clearDebt) => set({ clearDebt })}
        />
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
