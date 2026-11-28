"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { usePermission } from "@/hooks";
import { formatDateTime } from "@/lib/format";
import { formatCount } from "@/lib/report-format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cicService } from "@/services";
import type { CicCapture, CicStatus } from "@/types/cic";
import { captureLabel, fileCaptures } from "../../_lib/labels";

/** What the chosen capture holds, as the server counted it. */
export function CaptureFacts({ capture }: { capture: CicCapture }) {
  return (
    <dl className="grid max-w-xl grid-cols-[10rem_1fr] gap-x-4 gap-y-1.5 text-sm">
      <dt className="text-muted-foreground">Subjects</dt>
      <dd>{formatCount(capture.subject_count)}</dd>
      <dt className="text-muted-foreground">Contracts</dt>
      <dd>{formatCount(capture.contract_count)}</dd>
      <dt className="text-muted-foreground">Negative events</dt>
      <dd>{formatCount(capture.event_count)}</dd>
      <dt className="text-muted-foreground">Captured</dt>
      <dd>{capture.finished_at ? formatDateTime(capture.finished_at) : "—"}</dd>
    </dl>
  );
}

/**
 * A standard file's capture: a complete month-end capture, or a test capture
 * while the server allows them (staging), which `cic:prepare` can take here.
 */
export function CaptureStep({
  status,
  captures,
  captureId,
  locked,
  onPick,
  onCaptured,
}: {
  status: CicStatus;
  captures: CicCapture[];
  captureId: number | null;
  locked: boolean;
  onPick: (id: number | null) => void;
  onCaptured: (capture: CicCapture) => void;
}) {
  const { can } = usePermission();
  const [capturing, setCapturing] = useState(false);
  const choices = fileCaptures(captures, status.test_captures);
  const chosen = choices.find((c) => c.id === captureId) ?? null;

  const takeTestCapture = () => {
    setCapturing(true);
    cicService
      .createCapture({ kind: "test" })
      .then((capture) => {
        notifySuccess("Test capture taken.");
        onCaptured(capture);
      })
      .catch((err) => notifyError(err, "The test capture could not be taken."))
      .then(() => setCapturing(false));
  };

  return (
    <div className="max-w-xl space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="capture_id">Capture</Label>
        <NativeSelect
          id="capture_id"
          className="w-full"
          disabled={locked}
          value={captureId === null ? "" : String(captureId)}
          onChange={(e) => onPick(e.target.value ? Number(e.target.value) : null)}
        >
          <NativeSelectOption value="">Choose a capture</NativeSelectOption>
          {choices.map((c) => (
            <NativeSelectOption key={c.id} value={String(c.id)}>
              {captureLabel(c)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {choices.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No complete capture yet. The first month-end capture runs at 23:58 on the month&apos;s last day.
          </p>
        )}
      </div>
      {status.test_captures && can("cic:prepare") && !locked && (
        <div className="space-y-1.5">
          <Button type="button" variant="outline" disabled={capturing} onClick={takeTestCapture}>
            {capturing ? "Capturing…" : "Take a Test Capture"}
          </Button>
          <p className="text-xs text-muted-foreground">Test captures are on here: one is dated today and frozen now.</p>
        </div>
      )}
      {chosen && <CaptureFacts capture={chosen} />}
    </div>
  );
}
