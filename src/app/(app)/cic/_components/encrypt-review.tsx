"use client";

import { useCallback } from "react";
import { DataState } from "@/components/common/data-state";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useApiResource } from "@/hooks";
import { cicService } from "@/services";
import type { CicSubmission } from "@/types/cic";

/**
 * The review before encryption: the stored file as the server previews it,
 * personal data masked, the key it will be encrypted for, and the reviewer's
 * explicit confirmation. Nothing here rebuilds the file in the browser.
 */
export function EncryptReview({
  submission,
  keyFingerprint,
  confirmed,
  onConfirmedChange,
}: {
  submission: CicSubmission;
  /** The verified CIC key the server will encrypt for. */
  keyFingerprint: string | null;
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
}) {
  const fetcher = useCallback(() => cicService.getPreview(submission.id), [submission.id]);
  const preview = useApiResource(fetcher);

  return (
    <DataState
      resource={preview}
      summary="The generated file, masked, for review before it is encrypted."
      endpoints={["GET /cic/submissions/{id}/preview"]}
    >
      {(p) => (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <dl className="grid max-w-xl shrink-0 grid-cols-[10rem_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">File</dt>
            <dd className="font-mono text-xs">{submission.filename}</dd>
            <dt className="text-muted-foreground">Records</dt>
            <dd>
              {Object.entries(p.record_counts)
                .map(([type, n]) => `${type} ${n}`)
                .join(" · ") || "—"}
            </dd>
            <dt className="text-muted-foreground">Size</dt>
            <dd>
              {p.line_count} lines · {Math.ceil(p.byte_size / 1024)} KB before zipping
            </dd>
            <dt className="text-muted-foreground">Encrypt for key</dt>
            <dd className="break-all font-mono text-xs">{keyFingerprint ?? "No verified key"}</dd>
          </dl>
          <pre className="min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
            {p.lines.join("\n")}
          </pre>
          <p className="shrink-0 text-xs text-muted-foreground">
            The header, the first records and the footer, with names, IDs and addresses masked by the server.
          </p>
          <Label className="flex shrink-0 items-start gap-2 text-sm font-normal">
            <Checkbox
              checked={confirmed}
              disabled={!keyFingerprint}
              onCheckedChange={(on) => onConfirmedChange(on === true)}
            />
            I reviewed this file and confirm it is ready to be zipped and encrypted for CIC with the key above.
          </Label>
        </div>
      )}
    </DataState>
  );
}
