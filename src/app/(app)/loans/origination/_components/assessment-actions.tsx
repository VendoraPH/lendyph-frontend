"use client";

import { useState } from "react";
import { FileDown, Loader2, RotateCw } from "lucide-react";
import { PermissionButton } from "@/components/common/permission-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { notifyError, notifySuccess } from "@/lib/notify";
import { saveBlob } from "@/lib/save-blob";
import { loanOriginationService } from "@/services";
import type { Assessment } from "@/types/loan-origination";
import { ActionDialog } from "./action-dialog";

/** Downloads the server-rendered assessment PDF. */
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

/** Runs the assessment again on the current figures; the old version stays in history. */
export function RerunAssessmentButton({ applicationId, onDone }: { applicationId: number; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const rerun = () => {
    setBusy(true);
    loanOriginationService
      .rerunAssessment(applicationId)
      .then(() => {
        notifySuccess("Assessment updated");
        onDone();
      })
      .catch((err) => notifyError(err, "Could not run the assessment"))
      .then(() => setBusy(false));
  };
  return (
    <PermissionButton permission="loan_origination:assess" size="sm" variant="outline" onClick={rerun} disabled={busy}>
      {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RotateCw className="mr-1 h-4 w-4" />}
      Run again
    </PermissionButton>
  );
}

/** The officer's own findings and recommendations, saved on the assessment. */
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
          officer_findings: findings.trim(),
          recommendations: recommendations.trim(),
        })
      }
      onDone={onDone}
      size="md"
    >
      <div className="space-y-1.5">
        <Label htmlFor="officer-findings">Findings</Label>
        <Textarea id="officer-findings" rows={4} value={findings} onChange={(e) => setFindings(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="officer-recommendations">Recommendations</Label>
        <Textarea
          id="officer-recommendations"
          rows={3}
          value={recommendations}
          onChange={(e) => setRecommendations(e.target.value)}
        />
      </div>
    </ActionDialog>
  );
}
