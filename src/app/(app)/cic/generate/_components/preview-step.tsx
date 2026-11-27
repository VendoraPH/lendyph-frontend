"use client";

import { useMemo } from "react";
import { buildCsdfFile } from "@/lib/cic/csdf";
import type { CicRecordInput } from "@/lib/cic/types";
import type { CicSettings } from "@/types/cic";

/** Lines shown: the header, the first records and the footer. */
const HEAD = 20;

/**
 * Step 4: the file as the browser would build it from the records on screen.
 * It is only a preview. The backend builds the file CIC receives, so the plain
 * file, full of member details, is never saved unencrypted from here.
 */
export function PreviewStep({
  settings,
  referenceDate,
  submissionType,
  comments,
  inputs,
}: {
  settings: CicSettings;
  referenceDate: string;
  submissionType: 0 | 1;
  comments: string;
  inputs: CicRecordInput[];
}) {
  const file = useMemo(
    () =>
      buildCsdfFile({
        providerCode: settings.provider_code ?? "",
        fileReferenceDate: referenceDate,
        submissionType,
        comments: comments || undefined,
        records: inputs,
        createdAt: new Date(),
      }),
    [settings.provider_code, referenceDate, submissionType, comments, inputs],
  );
  const lines = file.content.split(/\r?\n/).filter(Boolean);
  const shown = lines.length > HEAD + 1 ? [...lines.slice(0, HEAD), "…", lines[lines.length - 1]] : lines;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-sm">
        <span className="font-mono">{file.filename}</span> · {file.recordCount} records ·{" "}
        {Math.ceil(new TextEncoder().encode(file.content).length / 1024)} KB before encryption
      </p>
      <pre className="min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
        {shown.join("\n")}
      </pre>
      <p className="shrink-0 text-xs text-muted-foreground">
        A preview. Lendy builds the file it keeps and sends to CIC on the next step, and it may differ in the
        timestamp of its name.
      </p>
    </div>
  );
}
