"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCount } from "@/lib/report-format";
import type { CicSubmissionDetail, CicValidationSummary } from "@/types/cic";
import { ValidationSummary } from "../../_components/validation-summary";

export interface GenerateOutcome {
  /** The server's last refusal, with its validation counts, until the next try. */
  refusal: { code: string | null; validation: CicValidationSummary } | null;
  /** The user read the warnings and wants the file anyway (`confirm_warnings`). */
  confirmWarnings: boolean;
}

/** Step 2: comments, then the server builds and checks the file; warnings need a confirmation. */
export function GenerateStep({
  submission,
  comments,
  outcome,
  generating,
  onComments,
  onConfirmWarnings,
  onGenerate,
}: {
  submission: CicSubmissionDetail | null;
  comments: string;
  outcome: GenerateOutcome;
  generating: boolean;
  onComments: (comments: string) => void;
  onConfirmWarnings: (on: boolean) => void;
  onGenerate: () => void;
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
  const warned = outcome.refusal?.code === "warnings_unconfirmed";
  return (
    <div className="max-w-2xl space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="comments">Comments (optional)</Label>
        <Input id="comments" maxLength={100} value={comments} onChange={(e) => onComments(e.target.value)} />
        <p className="text-xs text-muted-foreground">Written in the file header for CIC to read: up to 100 characters.</p>
      </div>
      {outcome.refusal && <ValidationSummary validation={outcome.refusal.validation} />}
      {warned && (
        <Label className="flex items-start gap-2 text-sm font-normal">
          <Checkbox checked={outcome.confirmWarnings} onCheckedChange={(on) => onConfirmWarnings(on === true)} />
          I read the warnings and want to generate the file with them.
        </Label>
      )}
      <Button type="button" disabled={generating || (warned && !outcome.confirmWarnings)} onClick={onGenerate}>
        {generating ? "Generating…" : "Generate File"}
      </Button>
    </div>
  );
}
