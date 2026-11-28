"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useApiResource } from "@/hooks";
import { cicService } from "@/services";
import { emptyDrain } from "@/lib/paginate";
import { notifyError } from "@/lib/notify";
import type { CicSubmission } from "@/types/cic";
import { CicPageHeader } from "../../_components/page-header";
import { CORRECTABLE_STATUSES } from "../../_components/submission-status-badge";
import { EncryptReview } from "../../_components/encrypt-review";
import { IssueList } from "../../_components/issue-list";
import { IssueSummary } from "../../_components/issue-summary";
import { useDateIssueList } from "../../_hooks/use-issue-lists";
import { useSubmissionActions } from "../../_hooks/use-submission-actions";
import { blockedReason, GENERATE_STEPS, type GenerateStep } from "../_lib/steps";
import { LifecycleStep } from "./lifecycle-step";
import { ReadinessStep } from "./readiness-step";
import { SetupStep, type SetupValue } from "./setup-step";
import { StepRail } from "./step-rail";

export function GenerateWizard({ initial }: { initial: Pick<SetupValue, "referenceDate" | "correctsId"> }) {
  const [step, setStep] = useState<GenerateStep>(0);
  const [setup, setSetup] = useState<SetupValue>({
    referenceDate: initial.referenceDate,
    submissionType: initial.correctsId === null ? 0 : 1,
    correctsId: initial.correctsId,
    correctionReason: "",
    comments: "",
  });
  const [submission, setSubmission] = useState<CicSubmission | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  // Fixed for the visit, so a key's expiry is judged without reading the clock in render.
  const [now] = useState(() => new Date());

  // Settings and the server's readiness figures follow the date chosen on step 1.
  const contextFetcher = useCallback(
    () =>
      Promise.all([cicService.getSettings(), cicService.getReadiness(setup.referenceDate)]).then(
        ([settings, readiness]) => ({ settings, readiness }),
      ),
    [setup.referenceDate],
  );
  const context = useApiResource(contextFetcher);
  const issues = useDateIssueList(setup.referenceDate);
  const submissionsFetcher = useCallback(() => cicService.listAllSubmissions().catch(() => emptyDrain<CicSubmission>()), []);
  const submissions = useApiResource(submissionsFetcher);
  const correctable = (submissions.data?.rows ?? []).filter((s) => CORRECTABLE_STATUSES.has(s.status));
  const actions = useSubmissionActions(setSubmission);

  const ctx = context.data;
  const keyFingerprint = ctx?.settings.public_key?.fingerprint ?? null;
  const blocked = blockedReason(step, {
    ...setup,
    settings: ctx?.settings ?? null,
    recordCount: ctx ? ctx.readiness.subjects.total + ctx.readiness.contracts.total : 0,
    errorCount: ctx?.readiness.issue_counts.errors ?? 0,
    submission,
    reviewed,
    downloaded,
    now,
  });
  // Readiness and validation cannot be judged until the server's figures are in.
  const waiting = (step === 1 || step === 2) && !ctx;
  // Once a file exists, its date and type are fixed.
  const locked = submission !== null;

  const generate = async () => {
    setGenerating(true);
    try {
      const created = await cicService.generate({
        file_reference_date: setup.referenceDate,
        submission_type: setup.submissionType,
        comments: setup.comments || undefined,
        corrects_submission_id: setup.correctsId ?? undefined,
        correction_reason: setup.submissionType === 1 ? setup.correctionReason.trim() : undefined,
      });
      setGenerating(false);
      setSubmission(created);
    } catch (err) {
      setGenerating(false);
      notifyError(err, "The file could not be generated.");
    }
  };

  return (
    <PageFill>
      <CicPageHeader
        title="Generate Report"
        description="Generate the Credit Submission Data File on the server, review it, encrypt it for CIC and record its submission."
      />
      <StepRail step={step} />

      <ScrollBox className="flex flex-col gap-4 p-px">
        {step === 0 && (
          <SetupStep value={setup} onChange={locked ? () => undefined : setSetup} correctable={correctable} />
        )}
        {(step === 1 || step === 2) && (
          <DataState
            resource={context}
            summary="The CIC settings and how ready the file is, worked out by the backend."
            endpoints={["GET /cic/settings", "GET /cic/readiness"]}
          >
            {({ settings, readiness }) =>
              step === 1 ? (
                <ReadinessStep settings={settings} readiness={readiness} />
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-4">
                  <IssueSummary
                    counts={readiness.issue_counts}
                    recordCount={readiness.subjects.total + readiness.contracts.total}
                  />
                  <IssueList key={setup.referenceDate} {...issues} />
                </div>
              )
            }
          </DataState>
        )}
        {step === 3 && (
          <div className="space-y-3">
            <p className="max-w-xl text-sm text-muted-foreground">
              The server builds the file from every record as of the File Reference Date, checks it again and stores
              it with the submission. You review it on the next step before it is encrypted.
            </p>
            {submission ? (
              <Alert>
                <AlertDescription>
                  Generated <span className="font-mono">{submission.filename}</span> with {submission.record_count}{" "}
                  records.
                </AlertDescription>
              </Alert>
            ) : (
              <Button disabled={generating} onClick={generate}>
                {generating ? "Generating…" : "Generate File"}
              </Button>
            )}
          </div>
        )}
        {step === 4 && submission && (
          <EncryptReview
            submission={submission}
            keyFingerprint={keyFingerprint}
            confirmed={reviewed}
            onConfirmedChange={setReviewed}
          />
        )}
        {step >= 5 && submission && keyFingerprint && (
          <LifecycleStep
            step={step as 5 | 6 | 7}
            submission={submission}
            keyFingerprint={keyFingerprint}
            actions={actions}
            onDownloaded={() => setDownloaded(true)}
          />
        )}
      </ScrollBox>

      <div data-fab-clear className="flex shrink-0 flex-wrap items-center gap-3 border-t pt-4">
        <Button
          variant="outline"
          disabled={step === 0 || (locked && step <= 4)}
          onClick={() => setStep((s) => (s - 1) as GenerateStep)}
        >
          Back
        </Button>
        {step < GENERATE_STEPS.length - 1 ? (
          <Button disabled={waiting || blocked !== null} onClick={() => setStep((s) => (s + 1) as GenerateStep)}>
            Next: {GENERATE_STEPS[step + 1]}
          </Button>
        ) : (
          <Button variant="outline" nativeButton={false} render={<Link href="/cic/submissions" />}>
            Done
          </Button>
        )}
        {!waiting && blocked && <p className="text-sm text-muted-foreground">{blocked}</p>}
      </div>
    </PageFill>
  );
}
