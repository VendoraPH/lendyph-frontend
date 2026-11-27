"use client";

import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, todayISO } from "@/lib/format";
import type { CicSubmission } from "@/types/cic";
import { ReferenceDateField } from "../../_components/reference-date-field";

export interface SetupValue {
  referenceDate: string;
  submissionType: 0 | 1;
  correctsId: number | null;
  comments: string;
}

/** Step 1: the File Reference Date, and whether the file is a regular or a correction file. */
export function SetupStep({
  value,
  onChange,
  correctable,
}: {
  value: SetupValue;
  onChange: (value: SetupValue) => void;
  /** Submissions a correction file can answer. */
  correctable: CicSubmission[];
}) {
  return (
    <div className="max-w-xl space-y-5">
      <ReferenceDateField
        value={value.referenceDate}
        onChange={(referenceDate) => onChange({ ...value, referenceDate })}
        max={todayISO()}
      />
      <p className="text-sm text-muted-foreground">
        Balances and statuses are reported as of this date, usually the last day of the month just closed.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="cic-submission-type">Submission type</Label>
        <NativeSelect
          id="cic-submission-type"
          value={String(value.submissionType)}
          onChange={(e) =>
            onChange({ ...value, submissionType: e.target.value === "1" ? 1 : 0, correctsId: null })
          }
        >
          <NativeSelectOption value="0">0 · Regular submission</NativeSelectOption>
          <NativeSelectOption value="1">1 · Correction file</NativeSelectOption>
        </NativeSelect>
      </div>

      {value.submissionType === 1 && (
        <div className="space-y-1.5">
          <Label htmlFor="cic-corrects">Corrects</Label>
          <NativeSelect
            id="cic-corrects"
            value={value.correctsId === null ? "" : String(value.correctsId)}
            onChange={(e) => onChange({ ...value, correctsId: e.target.value ? Number(e.target.value) : null })}
          >
            <NativeSelectOption value="">Choose a submission</NativeSelectOption>
            {correctable.map((s) => (
              <NativeSelectOption key={s.id} value={String(s.id)}>
                {s.filename} · {formatDate(s.file_reference_date)} · {s.status}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {correctable.length === 0 && (
            <p className="text-xs text-muted-foreground">No submitted file to correct yet.</p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="cic-comments">Comments (optional)</Label>
        <Textarea
          id="cic-comments"
          maxLength={100}
          value={value.comments}
          onChange={(e) => onChange({ ...value, comments: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">Sent in the file header for CIC to read.</p>
      </div>
    </div>
  );
}
