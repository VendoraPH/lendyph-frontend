"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BORROWER_STATUS_LABELS, BORROWER_STATUS_TONES, TONE_CLASSES } from "@/lib/loan-origination";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { publicApplicationService } from "@/services/public-application.service";
import type { PublicDocument, PublicPortal, Tracking } from "@/types/public-application";
import { TextField } from "../_components/form-field";
import { OtpVerify } from "../_components/otp-verify";
import { PortalError, PortalLoading, PortalShell } from "../_components/portal-shell";
import { DocumentRow } from "../_components/step-documents";
import { usePortal } from "../_hooks/use-portal";
import { publicErrorMessage, sessionProblem } from "../_lib/errors";
import { trackingClosure } from "../_lib/portal-state";
import { uploadRules, uploadRulesText } from "../_lib/uploads";

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

/** The server's tracking answer: a fixed set of fields, and the files the office asked for again. */
function TrackingResult({
  token,
  sessionToken,
  result,
  portal,
  onChanged,
  onFailed,
  onSignOut,
}: {
  token: string;
  sessionToken: string;
  result: Tracking;
  portal: PublicPortal;
  onChanged: () => void;
  onFailed: (err: unknown) => boolean;
  onSignOut: () => void;
}) {
  const rules = uploadRules(portal);
  const descriptions = Object.fromEntries(portal.documents.map((d) => [d.type, d.description]));
  return (
    <div className="space-y-5 rounded-xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Reference</p>
          <p className="text-lg font-semibold tabular-nums">{result.reference_number}</p>
          {result.submitted_at && <p className="text-xs text-muted-foreground">Submitted {formatDateTime(result.submitted_at)}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-3 py-1 text-sm font-medium", TONE_CLASSES[BORROWER_STATUS_TONES[result.status]])}>
            {BORROWER_STATUS_LABELS[result.status]}
          </span>
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut className="mr-1 h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
      <p className="whitespace-pre-line text-sm">{result.status_message}</p>
      {result.decision_notice && <p className="whitespace-pre-line rounded-lg bg-muted/50 p-3 text-sm">{result.decision_notice}</p>}
      <List title="We still need" items={result.outstanding_requirements} />
      <List title="What to do" items={result.requested_actions} />
      {result.replaceable_documents.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Upload these again</p>
          <p className="text-sm text-muted-foreground">{uploadRulesText(rules)}</p>
          <ul className="space-y-3">
            {result.replaceable_documents.map((d: PublicDocument) => (
              <DocumentRow
                key={d.type}
                document={d}
                description={descriptions[d.type] ?? null}
                rules={rules}
                token={token}
                sessionToken={sessionToken}
                canRemove={false}
                onUploaded={onChanged}
                onRemoved={onChanged}
                onFailed={onFailed}
              />
            ))}
          </ul>
        </div>
      )}
      {(result.contact.phone || result.contact.email) && (
        <p className="text-xs text-muted-foreground">Questions? {[result.contact.phone, result.contact.email].filter(Boolean).join(" · ")}</p>
      )}
    </div>
  );
}

/**
 * Applicants follow a submitted application with its reference number and a
 * code to the mobile they applied with. The session sees only the server's
 * tracking answer; it can replace a file the office asked for again, and
 * signing out always works.
 */
export default function TrackPage() {
  const { token } = useParams<{ token: string }>();
  const { portal, error, loading } = usePortal(token);
  const [reference, setReference] = useState("");
  const [tracked, setTracked] = useState<{ sessionToken: string; result: Tracking } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  /** Back to the start, with the server's words when the session ended. */
  const ended = (err: unknown): boolean => {
    if (sessionProblem(err) !== "ended") return false;
    setTracked(null);
    setNotice(publicErrorMessage(err, ""));
    return true;
  };

  const read = (sessionToken: string) => {
    setProblem(null);
    publicApplicationService.track(token, sessionToken).then(
      (result) => setTracked({ sessionToken, result }),
      (err) => {
        if (!ended(err)) setProblem(publicErrorMessage(err, "We could not find that application."));
      },
    );
  };

  const signOut = () => {
    if (!tracked) return;
    void publicApplicationService.logout(token, tracked.sessionToken);
    setTracked(null);
    setNotice("You signed out.");
  };

  const content = () => {
    if (loading) return <PortalLoading />;
    if (!portal) return <PortalError message={error ?? "This application link could not be opened."} />;
    if (tracked) {
      return (
        <TrackingResult
          token={token}
          sessionToken={tracked.sessionToken}
          result={tracked.result}
          portal={portal}
          onChanged={() => read(tracked.sessionToken)}
          onFailed={ended}
          onSignOut={signOut}
        />
      );
    }
    const closed = trackingClosure(portal);
    return (
      <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
        <div>
          <h1 className="text-xl font-semibold">Check your application</h1>
          <p className="text-sm text-muted-foreground">Enter your reference number and the mobile number you applied with.</p>
        </div>
        {notice && (
          <p className="rounded-lg border bg-muted/40 p-3 text-sm" role="status">
            {notice}
          </p>
        )}
        {closed ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200" role="status">
            {closed}
          </p>
        ) : (
          <>
            <TextField id="reference" label="Reference number" required placeholder="OA-2026-000001" value={reference} onChange={(v) => setReference(v.toUpperCase())} />
            {reference.trim().length >= 4 && (
              <OtpVerify token={token} purpose="track" referenceNumber={reference.trim()} onVerified={(session) => read(session.session_token)} />
            )}
          </>
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
