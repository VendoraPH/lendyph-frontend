"use client";

import { useState } from "react";
import { CheckCircle2, FileUp, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/loan-origination";
import { publicApplicationService } from "@/services/public-application.service";
import type { PublicDocument } from "@/types/public-application";
import { publicErrorMessage } from "../_lib/errors";
import { fileProblem, uploadAccept, uploadPercent, uploadRulesText, type UploadRules } from "../_lib/uploads";

/** What a file row needs to reach the server, and what it tells its list. */
export interface DocumentRowProps {
  document: PublicDocument;
  description: string | null;
  rules: UploadRules;
  token: string;
  sessionToken: string;
  /** Only while the draft is open; a submitted application can only have a file replaced. */
  canRemove: boolean;
  onUploaded: (document: PublicDocument) => void;
  onRemoved: (type: string) => void;
  /** A session refusal goes to the page; true when it was one. */
  onFailed: (err: unknown) => boolean;
}

/** One document type: its file, if any, and Upload, Replace or Remove. */
export function DocumentRow({ document: doc, description, rules, token, sessionToken, canRemove, onUploaded, onRemoved, onFailed }: DocumentRowProps) {
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const inputId = `doc-${doc.type}`;
  const hasFile = doc.file_name !== null;

  const failed = (err: unknown, fallback: string) => {
    if (!onFailed(err)) setProblem(publicErrorMessage(err, fallback));
  };

  const upload = (file: File | undefined) => {
    if (!file) return;
    const bad = fileProblem(file, rules);
    setProblem(bad);
    if (bad) return;
    setProgress(0);
    publicApplicationService
      .uploadDocument(token, sessionToken, doc.type, file, (sent, size) => setProgress(uploadPercent(sent, size)))
      .then(onUploaded)
      .catch((err) => failed(err, "The upload did not finish. Try again."))
      .then(() => setProgress(null));
  };

  const remove = () => {
    if (doc.id === null) return;
    setProblem(null);
    publicApplicationService
      .removeDocument(token, sessionToken, doc.id)
      .then(() => onRemoved(doc.type))
      .catch((err) => failed(err, "We could not remove that file."));
  };

  return (
    <li className="space-y-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            {hasFile && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" aria-label="Uploaded" />}
            {doc.label}
            <span className="text-xs font-normal text-muted-foreground">{doc.required ? "Required" : "Optional"}</span>
          </p>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          {doc.file_name && (
            <p className="truncate text-sm">
              {doc.file_name} <span className="text-muted-foreground">· {formatFileSize(doc.size_bytes)}</span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {canRemove && doc.id !== null && progress === null && (
            <Button type="button" variant="ghost" size="sm" onClick={remove}>
              <Trash2 className="mr-1 h-4 w-4" /> Remove
            </Button>
          )}
          <Button type="button" variant={hasFile ? "outline" : "default"} size="sm" disabled={progress !== null} nativeButton={false} render={<label htmlFor={inputId} />}>
            {progress !== null ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileUp className="mr-1 h-4 w-4" />}
            {hasFile ? "Replace" : "Upload"}
          </Button>
          <input
            id={inputId}
            type="file"
            className="sr-only"
            accept={uploadAccept(rules)}
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      {progress !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${doc.label}`}>
          <div className="h-full bg-brand-orange transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}
      {problem && (
        <p className="text-sm text-destructive" role="alert">
          {problem}
        </p>
      )}
    </li>
  );
}

/**
 * The documents the server lists for this application's product, each with
 * its file. After every upload or removal the server's view is read again.
 */
export function StepDocuments({
  documents,
  descriptions,
  rules,
  error,
  row,
}: {
  documents: PublicDocument[];
  descriptions: Record<string, string | null>;
  rules: UploadRules;
  error?: string;
  row: Omit<DocumentRowProps, "document" | "description" | "rules">;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Clear photos or scans are fine. {uploadRulesText(rules)}</p>
      <ul className="space-y-3">
        {documents.map((d) => (
          <DocumentRow key={d.type} document={d} description={descriptions[d.type] ?? null} rules={rules} {...row} />
        ))}
      </ul>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
