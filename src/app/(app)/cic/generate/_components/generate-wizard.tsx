"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useApiResource } from "@/hooks";
import { cicService } from "@/services";
import { emptyDrain } from "@/lib/paginate";
import { notifyError } from "@/lib/notify";
import { summarizeCicIssues } from "@/lib/cic/validate";
import type { CicSubmission } from "@/types/cic";
import { CicPageHeader } from "../../_components/page-header";
import { CORRECTABLE_STATUSES } from "../../_components/submission-status-badge";
import { IssueList } from "../../_components/issue-list";
import { IssueSummary } from "../../_components/issue-summary";
import { CIC_RECORD_ENDPOINTS, useCicRecords } from "../../_hooks/use-cic-records";
import { useSubmissionActions } from "../../_hooks/use-submission-actions";
import { blockedReason, GENERATE_STEPS, type GenerateStep } from "../_lib/steps";
import { LifecycleStep } from "./lifecycle-step";
import { PreviewStep } from "./preview-step";
import { SetupStep, type SetupValue } from "./setup-step";
import { StepRail } from "./step-rail";

export function GenerateWizard({ initial }: { initial: Pick<SetupValue, "referenceDate" | "correctsId"> }) {
  const [step, setStep] = useState<GenerateStep>(0);
  const [setup, setSetup] = useState<SetupValue>({
    referenceDate: initial.referenceDate,
    submissionType: initial.correctsId === null ? 0 : 1,
    correctsId: initial.correctsId,
    comments: "",
  });
  const [submission, setSubmission] = useState<CicSubmission | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Records follow the date chosen on step 1, so they are ready by step 2.
  const records = useCicRecords(setup.referenceDate);
  const submissionsFetcher = useCallback(() => cicService.listAllSubmissions().catch(() => emptyDrain<CicSubmission>()), []);
  const submissions = useApiResource(submissionsFetcher);
  const correctable = (submissions.data?.rows ?? []).filter((s) => CORRECTABLE_STATUSES.has(s.status));
  const actions = useSubmissionActions(setSubmission);

  const set = records.data;
  const summary = set ? summarizeCicIssues(set.issues) : null;
  const blocked = blockedReason(step, {
    referenceDate: setup.referenceDate,
    submissionType: setup.submissionType,
    correctsId: setup.correctsId,
    settings: set?.settings ?? null,
    recordCount: set?.inputs.length ?? 0,
    errorCount: summary?.errors ?? 0,
    submission,
    downloaded,
  });
  // Nothing past step 1 can be judged until the records are in.
  const waiting = step > 0 && step < 4 && !set;
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
      });
      setGenerating(false);
      setSubmission(created);
    } catch (err) {
      setGenerating(false);
      notifyError(err, "The file could not be generated.");
    }
  };

  const recordStep = (
    <DataState
      resource={records}
      summary="Every member and loan CIC will receive, checked before the file is generated."
      endpoints={CIC_RECORD_ENDPOINTS}
    >
      {(data) => (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {data.truncated && (
            <IncompleteListNotice
              shown={data.inputs.length}
              total={data.total}
              noun="records"
              consequence="Not every record was checked here; the backend checks the full file when it generates it."
            />
          )}
          {step === 1 && (
            <dl className="grid max-w-xl grid-cols-[12rem_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Provider code</dt>
              <dd className="font-mono">{data.settings.provider_code ?? "Not set"}</dd>
              <dt className="text-muted-foreground">Reporting as</dt>
              <dd>{data.settings.is_mfi ? "Microfinance institution" : "Lender (not MFI)"}</dd>
              <dt className="text-muted-foreground">CIC public key</dt>
              <dd className="break-all font-mono text-xs">{data.settings.public_key?.fingerprint ?? "Not uploaded"}</dd>
              <dt className="text-muted-foreground">Subjects</dt>
              <dd>{data.subjects.length}</dd>
              <dt className="text-muted-foreground">Contracts</dt>
              <dd>{data.contracts.length}</dd>
            </dl>
          )}
          {step === 2 && (
            <>
              <IssueSummary issues={data.issues} recordCount={data.inputs.length} />
              <IssueList issues={data.issues} csvName={`cic-validation-${setup.referenceDate}.csv`} />
            </>
          )}
          {step === 3 && (
            <PreviewStep
              settings={data.settings}
              referenceDate={setup.referenceDate}
              submissionType={setup.submissionType}
              comments={setup.comments}
              inputs={data.inputs}
            />
          )}
        </div>
      )}
    </DataState>
  );

  return (
    <PageFill>
      <CicPageHeader
        title="Generate Report"
        description="Build the Credit Submission Data File, encrypt it for CIC and record its submission."
      />
      <StepRail step={step} />

      <ScrollBox className="flex flex-col gap-4 p-px">
        {step === 0 && (
          <SetupStep
            value={setup}
            onChange={locked ? () => undefined : setSetup}
            correctable={correctable}
          />
        )}
        {step >= 1 && step <= 3 && recordStep}
        {step === 4 && (
          <div className="space-y-3">
            <p className="max-w-xl text-sm text-muted-foreground">
              Lendy builds the file from every record as of the File Reference Date, checks it again and keeps it
              in the submission history.
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
        {step >= 5 && submission && (
          <LifecycleStep
            step={step as 5 | 6 | 7}
            submission={submission}
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
