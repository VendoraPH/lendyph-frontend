"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCount } from "@/lib/report-format";
import type { CicSubmissionDetail, CicValidationSummary } from "@/types/cic";
import { ValidationSummary } from "../../_components/validation-summary";

export interface GenerateOutcome {
  /** The server's last refusal, with its words and validation counts, until the next try. */
  refusal: { code: string | null; message: string; validation: CicValidationSummary } | null;
}

/** The server's warnings: not an error, so amber, with the confirmation that sends `confirm_warnings`. */
function WarningsToConfirm({
  message,
  validation,
  generating,
  onConfirm,
}: {
  message: string;
  validation: CicValidationSummary;
  generating: boolean;
  onConfirm: () => void;
}) {
  return (
    <div
      role="status"
      className="space-y-3 rounded-lg border border-amber-300 bg-amber-50/50 p-4 text-sm dark:border-amber-700 dark:bg-amber-900/10"
    >
      <p className="flex items-start gap-2 font-medium text-amber-800 dark:text-amber-400">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {message}
      </p>
      <ValidationSummary validation={validation} />
      <Button type="button" disabled={generating} onClick={onConfirm}>
        {generating ? "Generating…" : "Generate with These Warnings"}
      </Button>
    </div>
  );
}

/** Step 2: comments, then the server builds and checks the file; warnings need a confirmation. */
export function GenerateStep({
  submission,
  comments,
  outcome,
  generating,
  onComments,
  onGenerate,
}: {
  submission: CicSubmissionDetail | null;
  comments: string;
  outcome: GenerateOutcome;
  generating: boolean;
  onComments: (comments: string) => void;
  /** `confirmWarnings`: the user read the warnings and wants the file anyway. */
  onGenerate: (confirmWarnings: boolean) => void;
}) {
  if (submission) {
    return (
      <Alert>
        <AlertDescription>
          Generated {submission.reference}, <span className="font-mono">{submission.filename}</span>, with{" "}
          {formatCount(submission.record_count)} records.
        </AlertDescription>
      </Alert>
    );
  }
  const refusal = outcome.refusal;
  const warned = refusal?.code === "warnings_unconfirmed";
  return (
    <div className="max-w-2xl space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="comments">Comments (optional)</Label>
        <Input id="comments" maxLength={100} value={comments} onChange={(e) => onComments(e.target.value)} />
        <p className="text-xs text-muted-foreground">Written in the file header for CIC to read: up to 100 characters.</p>
      </div>
      {refusal && warned && (
        <WarningsToConfirm
          message={refusal.message}
          validation={refusal.validation}
          generating={generating}
          onConfirm={() => onGenerate(true)}
        />
      )}
      {refusal && !warned && <ValidationSummary validation={refusal.validation} />}
      {!warned && (
        <Button type="button" disabled={generating} onClick={() => onGenerate(false)}>
          {generating ? "Generating…" : "Generate File"}
        </Button>
      )}
    </div>
  );
}
