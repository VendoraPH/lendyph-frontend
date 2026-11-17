"use client";

import { useState } from "react";
import { CheckCircle2, FileUp, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileProblem, formatFileSize } from "@/lib/loan-origination";
import { publicApplicationService, publicErrorMessage } from "@/services/public-application.service";
import type { ApplicationDocument, DocumentRequirement } from "@/types/loan-origination";

/** A requirement counts as met once a file for it is in and not turned down. */
export function documentMet(doc: ApplicationDocument | undefined): boolean {
  return !!doc && doc.status !== "not_submitted" && doc.status !== "rejected" && doc.status !== "replacement_requested";
}

export function requiredDocumentsMet(requirements: DocumentRequirement[], documents: ApplicationDocument[]): boolean {
  return requirements.filter((r) => r.required).every((r) => documentMet(documents.find((d) => d.type === r.type)));
}

function DocumentRow({
  requirement,
  doc,
  accept,
  maxMb,
  token,
  sessionToken,
  onUploaded,
  onRemoved,
}: {
  requirement: DocumentRequirement;
  doc: ApplicationDocument | undefined;
  accept: string[];
  maxMb: number;
  token: string;
  sessionToken: string;
  onUploaded: (doc: ApplicationDocument) => void;
  onRemoved: (id: number) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const inputId = `doc-${requirement.type}`;
  const met = documentMet(doc);

  const upload = (file: File | undefined) => {
    if (!file) return;
    const bad = fileProblem(file, accept, maxMb);
    setProblem(bad);
    if (bad) return;
    setProgress(0);
    publicApplicationService
      .uploadDocument(token, sessionToken, requirement.type, file, setProgress)
      .then(onUploaded)
      .catch((err) => setProblem(publicErrorMessage(err, "The upload did not finish. Try again.")))
      .then(() => setProgress(null));
  };

  const remove = () => {
    if (!doc) return;
    setProblem(null);
    publicApplicationService
      .removeDocument(token, sessionToken, doc.id)
      .then(() => onRemoved(doc.id))
      .catch((err) => setProblem(publicErrorMessage(err, "We could not remove that file.")));
  };

  return (
    <li className="space-y-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            {met && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" aria-label="Uploaded" />}
            {requirement.label}
            <span className="text-xs font-normal text-muted-foreground">{requirement.required ? "Required" : "Optional"}</span>
          </p>
          {requirement.description && <p className="text-sm text-muted-foreground">{requirement.description}</p>}
          {doc?.file_name && (
            <p className="truncate text-sm">
              {doc.file_name} <span className="text-muted-foreground">· {formatFileSize(doc.size_bytes)}</span>
            </p>
          )}
          {doc?.rejection_reason && (doc.status === "rejected" || doc.status === "replacement_requested") && (
            <p className="text-sm text-destructive">Please upload another file: {doc.rejection_reason}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {doc?.file_name && progress === null && (
            <Button type="button" variant="ghost" size="sm" onClick={remove}>
              <Trash2 className="mr-1 h-4 w-4" /> Remove
            </Button>
          )}
          <Button type="button" variant={met ? "outline" : "default"} size="sm" disabled={progress !== null} nativeButton={false} render={<label htmlFor={inputId} />}>
            {progress !== null ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileUp className="mr-1 h-4 w-4" />}
            {doc?.file_name ? "Replace" : "Upload"}
          </Button>
          <input
            id={inputId}
            type="file"
            className="sr-only"
            accept={accept.map((t) => `.${t.replace(/^\./, "")}`).join(",")}
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      {progress !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${requirement.label}`}>
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

export function StepDocuments({
  requirements,
  documents,
  accept,
  maxMb,
  token,
  sessionToken,
  error,
  onChange,
}: {
  requirements: DocumentRequirement[];
  documents: ApplicationDocument[];
  accept: string[];
  maxMb: number;
  token: string;
  sessionToken: string;
  error?: string;
  onChange: (documents: ApplicationDocument[]) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Clear photos or scans are fine. {accept.map((t) => t.toUpperCase()).join(", ")}, up to {maxMb} MB each.
      </p>
      <ul className="space-y-3">
        {requirements.map((r) => (
          <DocumentRow
            key={r.type}
            requirement={r}
            doc={documents.find((d) => d.type === r.type)}
            accept={accept}
            maxMb={maxMb}
            token={token}
            sessionToken={sessionToken}
            onUploaded={(doc) => onChange([...documents.filter((d) => d.type !== doc.type), doc])}
            onRemoved={(id) => onChange(documents.filter((d) => d.id !== id))}
          />
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
