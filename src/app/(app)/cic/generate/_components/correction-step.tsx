"use client";

import { useState } from "react";
import Link from "next/link";
import { REASON_MAX_LENGTH } from "@/components/common/reason-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cicService } from "@/services";
import type { CicCapture, CicSubmissionDetail } from "@/types/cic";
import { captureLabel } from "../../_lib/labels";
import { CaptureFacts } from "./capture-step";

/**
 * A correction file's capture: a correction capture of the original file's
 * month-end capture. Member details are read again from today's records;
 * contract figures stay as captured at month end. The server lists the
 * records that changed once the file is generated.
 */
export function CorrectionStep({
  original,
  captures,
  captureId,
  reason,
  locked,
  onPick,
  onCaptured,
  onReason,
}: {
  original: CicSubmissionDetail;
  captures: CicCapture[];
  captureId: number | null;
  reason: string;
  locked: boolean;
  onPick: (id: number | null) => void;
  onCaptured: (capture: CicCapture) => void;
  onReason: (reason: string) => void;
}) {
  const [capturing, setCapturing] = useState(false);
  const choices = captures.filter(
    (c) => c.kind === "correction" && c.status === "complete" && c.corrects_capture_id === original.capture_id,
  );
  const chosen = choices.find((c) => c.id === captureId) ?? null;

  const takeCorrectionCapture = () => {
    setCapturing(true);
    cicService
      .createCapture({ kind: "correction", corrects_capture_id: original.capture_id })
      .then((capture) => {
        notifySuccess("Correction capture taken.");
        onCaptured(capture);
      })
      .catch((err) => notifyError(err, "The correction capture could not be taken."))
      .then(() => setCapturing(false));
  };

  if (!original.actions.correct) {
    return (
      <p className="max-w-xl text-sm text-muted-foreground">
        {original.reference} can&apos;t be corrected: only a file CIC has received can be, by someone who prepares CIC
        files.{" "}
        <Link href={`/cic/submissions/${original.id}`} className="underline">
          Open the file
        </Link>
      </p>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Corrects</dt>
        <dd>
          <Link href={`/cic/submissions/${original.id}`} className="underline">
            {original.reference}
          </Link>{" "}
          · {original.status_label}
        </dd>
        <dt className="text-muted-foreground">Reference date</dt>
        <dd>{formatDate(original.reference_date)}</dd>
      </dl>
      <div className="space-y-1.5">
        <Label htmlFor="capture_id">Correction capture</Label>
        <NativeSelect
          id="capture_id"
          className="w-full"
          disabled={locked}
          value={captureId === null ? "" : String(captureId)}
          onChange={(e) => onPick(e.target.value ? Number(e.target.value) : null)}
        >
          <NativeSelectOption value="">Choose a correction capture</NativeSelectOption>
          {choices.map((c) => (
            <NativeSelectOption key={c.id} value={String(c.id)}>
              {captureLabel(c)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {!locked && (
          <Button type="button" variant="outline" disabled={capturing} onClick={takeCorrectionCapture}>
            {capturing ? "Capturing…" : "Take a Correction Capture"}
          </Button>
        )}
      </div>
      {chosen && <CaptureFacts capture={chosen} />}
      <div className="space-y-1.5">
        <Label htmlFor="correction_reason">Reason for the correction</Label>
        <Textarea
          id="correction_reason"
          maxLength={REASON_MAX_LENGTH}
          disabled={locked}
          value={reason}
          onChange={(e) => onReason(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          What was wrong, for example CIC&apos;s rejection or a corrected member detail. Kept with the file.
        </p>
      </div>
    </div>
  );
}
