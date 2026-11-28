"use client";

import { useCallback, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DataState } from "@/components/common/data-state";
import { FormStep, FormStepper } from "@/components/common/form-stepper";
import { PageFill } from "@/components/common/page-fill";
import { useApiResource } from "@/hooks";
import { getErrorMessage } from "@/lib/api-error";
import { errorMessages, type StepErrors } from "@/lib/form-stepper";
import { notifyError, notifyWarning } from "@/lib/notify";
import { FIT_CLASSES } from "@/lib/page-fill";
import { cicService } from "@/services";
import type { CicCapture, CicStatus, CicSubmissionDetail } from "@/types/cic";
import { CicPageHeader } from "../../_components/page-header";
import { EncryptConfirmation } from "../../_components/encrypt-confirmation";
import { SubmissionReview } from "../../_components/submission-review";
import { useSubmissionActions } from "../../_hooks/use-submission-actions";
import { cicRefusal } from "@/lib/cic/refusal";
import { generateStepErrors, generateSteps } from "../_lib/steps";
import { CaptureStep } from "./capture-step";
import { CorrectionStep } from "./correction-step";
import { DownloadStep, EncryptStep } from "./file-steps";
import { GenerateStep, type GenerateOutcome } from "./generate-step";

interface WizardContext {
  status: CicStatus;
  captures: CicCapture[];
  /** The file a correction answers. */
  original: CicSubmissionDetail | null;
}

function Wizard({ context, correctsId }: { context: WizardContext; correctsId: number | null }) {
  const router = useRouter();
  const correction = correctsId !== null;
  const [captures, setCaptures] = useState(context.captures);
  const [captureId, setCaptureId] = useState<number | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [comments, setComments] = useState("");
  const [submission, setSubmission] = useState<CicSubmissionDetail | null>(null);
  const [outcome, setOutcome] = useState<GenerateOutcome>({ refusal: null });
  const [generating, setGenerating] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const actions = useSubmissionActions(setSubmission);
  // Once a file exists, its capture and reason are fixed.
  const locked = submission !== null;

  const captured = (capture: CicCapture) => {
    setCaptures((prev) => [capture, ...prev.filter((c) => c.id !== capture.id)]);
    setCaptureId(capture.id);
  };

  const pick = (id: number | null) => {
    setCaptureId(id);
    setOutcome({ refusal: null });
  };

  const generate = async (confirmWarnings: boolean) => {
    if (captureId === null) return;
    setGenerating(true);
    try {
      const created = await cicService.generate({
        capture_id: captureId,
        submission_type: correction ? 1 : 0,
        comments: comments.trim() || undefined,
        confirm_warnings: confirmWarnings || undefined,
        corrects_submission_id: correctsId ?? undefined,
        correction_reason: correction ? correctionReason.trim() : undefined,
      });
      setGenerating(false);
      setSubmission(created);
    } catch (err) {
      setGenerating(false);
      const refusal = cicRefusal(err);
      const message = getErrorMessage(err, "The file could not be generated.");
      setOutcome({ refusal: refusal.validation ? { code: refusal.code, message, validation: refusal.validation } : null });
      // Warnings aren't an error: the step shows them in amber, with the confirmation.
      if (refusal.code === "warnings_unconfirmed") notifyWarning(message);
      else notifyError(err, "The file could not be generated.");
    }
  };

  const state = { correction, captureId, correctionReason, submission, confirmed, downloaded };
  const validateStep = (stepId: string): StepErrors | true => generateStepErrors(stepId, state);
  const onInvalid = (errors: StepErrors) => notifyWarning(errorMessages(errors)[0] ?? "Finish this step first.");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!submission) return;
    if (await actions.markSubmitted(submission)) router.push(`/cic/submissions/${submission.id}`);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className={FIT_CLASSES.section}>
      <FormStepper
        steps={generateSteps(correction)}
        validateStep={validateStep}
        onInvalid={onInvalid}
        submitLabel="Mark Submitted to CIC"
        submittingLabel="Saving…"
        submitting={actions.busy === "submit"}
        submitDisabled={!submission?.actions.mark_submitted}
        nextDisabled={generating || actions.busy !== null}
      >
        <FormStep id="capture">
          {correction && context.original ? (
            <CorrectionStep
              original={context.original}
              captures={captures}
              captureId={captureId}
              reason={correctionReason}
              locked={locked}
              onPick={pick}
              onCaptured={captured}
              onReason={setCorrectionReason}
            />
          ) : (
            <CaptureStep
              status={context.status}
              captures={captures}
              captureId={captureId}
              locked={locked}
              onPick={pick}
              onCaptured={captured}
            />
          )}
        </FormStep>
        <FormStep id="generate">
          <GenerateStep
            submission={submission}
            comments={comments}
            outcome={outcome}
            generating={generating}
            onComments={setComments}
            onGenerate={generate}
          />
        </FormStep>
        <FormStep id="review">
          {submission && (
            <div className="space-y-6">
              <SubmissionReview detail={submission} />
              {submission.status === "generated" && (
                <EncryptConfirmation detail={submission} confirmed={confirmed} onConfirmedChange={setConfirmed} />
              )}
            </div>
          )}
        </FormStep>
        <FormStep id="encrypt">
          {submission && (
            <EncryptStep
              submission={submission}
              confirmed={confirmed}
              busy={actions.busy === "encrypt"}
              onEncrypt={() => void actions.encrypt(submission)}
            />
          )}
        </FormStep>
        <FormStep id="download">
          {submission && (
            <DownloadStep
              submission={submission}
              busy={actions.busy === "download"}
              onDownload={async () => {
                if (await actions.download(submission)) setDownloaded(true);
              }}
            />
          )}
        </FormStep>
        <FormStep id="submit">
          {submission && !submission.actions.mark_submitted && (
            <p className="text-sm text-muted-foreground">
              {submission.status === "encrypted"
                ? "You can't mark CIC files submitted."
                : `This file is already ${submission.status_label.toLowerCase()}.`}
            </p>
          )}
        </FormStep>
      </FormStepper>
    </form>
  );
}

/** Generate Report: from a capture to the encrypted file, reviewed, downloaded and marked submitted. */
export function GenerateWizard({ correctsId }: { correctsId: number | null }) {
  const fetcher = useCallback(
    () =>
      Promise.all([
        cicService.getStatus(),
        cicService.listAllCaptures(),
        correctsId === null ? Promise.resolve(null) : cicService.getSubmission(correctsId),
      ]).then(([status, captures, original]): WizardContext => ({ status, captures: captures.rows, original })),
    [correctsId],
  );
  const context = useApiResource(fetcher);

  return (
    <PageFill>
      <CicPageHeader
        title={correctsId === null ? "Generate Report" : "Prepare Correction"}
        description="The server builds the Credit Submission Data File from a capture; you review it, it is encrypted for CIC, and you record its submission."
      />
      <DataState
        resource={context}
        summary="CIC's set-up, the captures to build a file from and, for a correction, the file it corrects."
        endpoints={["GET /cic/status", "GET /cic/captures", "GET /cic/submissions/{id}"]}
      >
        {(ctx) => <Wizard context={ctx} correctsId={correctsId} />}
      </DataState>
    </PageFill>
  );
}
