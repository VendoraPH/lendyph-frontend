"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BORROWER_STATUS_LABELS, BORROWER_STATUS_TONES, TONE_CLASSES } from "@/lib/loan-origination";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { publicApplicationService, publicErrorMessage } from "@/services/public-application.service";
import type { ApplicationDocument, PublicTrackingResult } from "@/types/loan-origination";
import { TextField } from "../_components/form-field";
import { OtpVerify } from "../_components/otp-verify";
import { PortalError, PortalLoading, PortalShell } from "../_components/portal-shell";
import { StepDocuments } from "../_components/step-documents";
import { usePortal } from "../_hooks/use-portal";

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function TrackingResult({
  token,
  sessionToken,
  result,
  accept,
  maxMb,
}: {
  token: string;
  sessionToken: string;
  result: PublicTrackingResult;
  accept: string[];
  maxMb: number;
}) {
  const [documents, setDocuments] = useState<ApplicationDocument[]>(result.replaceable_documents);
  return (
    <div className="space-y-5 rounded-xl border bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Reference</p>
          <p className="text-lg font-semibold tabular-nums">{result.reference_number}</p>
          {result.submitted_at && <p className="text-xs text-muted-foreground">Submitted {formatDateTime(result.submitted_at)}</p>}
        </div>
        <span className={cn("rounded-full px-3 py-1 text-sm font-medium", TONE_CLASSES[BORROWER_STATUS_TONES[result.status]])}>
          {BORROWER_STATUS_LABELS[result.status]}
        </span>
      </div>
      {result.status_message && <p className="whitespace-pre-line text-sm">{result.status_message}</p>}
      {result.decision_notice && <p className="whitespace-pre-line rounded-lg bg-muted/50 p-3 text-sm">{result.decision_notice}</p>}
      <List title="We still need" items={result.outstanding_requirements} />
      <List title="Please" items={result.requested_actions} />
      {result.replaceable_documents.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Upload these again</p>
          <StepDocuments
            requirements={result.replaceable_documents.map((d) => ({ type: d.type, label: d.label, description: null, required: d.required }))}
            documents={documents}
            accept={accept}
            maxMb={maxMb}
            token={token}
            sessionToken={sessionToken}
            onChange={setDocuments}
          />
        </div>
      )}
      {(result.contact.phone || result.contact.email) && (
        <p className="text-xs text-muted-foreground">Questions? {[result.contact.phone, result.contact.email].filter(Boolean).join(" · ")}</p>
      )}
    </div>
  );
}

/** Applicants check a submitted application with its reference number and a code to their mobile. */
export default function TrackPage() {
  const { token } = useParams<{ token: string }>();
  const { portal, error, loading } = usePortal(token);
  const [reference, setReference] = useState("");
  const [tracked, setTracked] = useState<{ sessionToken: string; result: PublicTrackingResult } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const content = () => {
    if (loading) return <PortalLoading />;
    if (!portal) return <PortalError message={error ?? "This application link could not be opened."} />;
    if (tracked) {
      return (
        <TrackingResult token={token} sessionToken={tracked.sessionToken} result={tracked.result} accept={portal.accepted_file_types} maxMb={portal.max_upload_mb} />
      );
    }
    return (
      <div className="space-y-4 rounded-xl border bg-white p-4 sm:p-6">
        <div>
          <h1 className="text-xl font-semibold">Check your application</h1>
          <p className="text-sm text-muted-foreground">Enter your reference number and the mobile number you applied with.</p>
        </div>
        <TextField id="reference" label="Reference number" required value={reference} onChange={(v) => setReference(v.toUpperCase())} />
        {reference.trim().length >= 4 && (
          <OtpVerify
            token={token}
            purpose="track"
            channels={portal.otp_channels}
            referenceNumber={reference.trim()}
            onVerified={(session) => {
              setProblem(null);
              publicApplicationService
                .track(token, session.session_token)
                .then((result) => setTracked({ sessionToken: session.session_token, result }))
                .catch((err) => setProblem(publicErrorMessage(err, "We could not find that application.")));
            }}
          />
        )}
        {problem && (
          <p className="text-sm text-destructive" role="alert">
            {problem}
          </p>
        )}
        <Link href={`/apply/${token}`} className="inline-block text-sm text-brand-orange underline-offset-4 hover:underline">
          Back to the application page
        </Link>
      </div>
    );
  };

  return <PortalShell portal={portal}>{content()}</PortalShell>;
}
