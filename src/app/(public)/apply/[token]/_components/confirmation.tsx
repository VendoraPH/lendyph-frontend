"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { Submitted } from "@/types/public-application";

/** `ApplicantSessions::SUBMITTED`, when the reference couldn't be read back. */
const SUBMITTED = "This application has been submitted. Ask for a code with your reference number to follow it.";

/**
 * After submit. `already`: the session had submitted before (a lost answer,
 * then any other request answered `session_submitted`); a retried submit gave
 * the same reference back.
 */
export function Confirmation({ token, result, already }: { token: string; result: Submitted | null; already: boolean }) {
  return (
    <div className="space-y-6 rounded-xl border bg-card p-6 text-center" role="status">
      <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{already ? "Already submitted" : "Application received"}</h1>
        {already && <p className="text-muted-foreground">This application was submitted before, so nothing more was sent.</p>}
        {result?.submitted_at && <p className="text-muted-foreground">Submitted {formatDateTime(result.submitted_at)}.</p>}
      </div>
      {result ? (
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">Your reference number</p>
          <p className="text-2xl font-semibold tracking-wide tabular-nums">{result.reference_number}</p>
          <p className="mt-1 text-xs text-muted-foreground">Keep it to check your status.</p>
        </div>
      ) : (
        <p className="rounded-lg bg-muted/50 p-4 text-sm">{SUBMITTED}</p>
      )}
      <div className="space-y-1 text-left text-sm">
        <p className="font-medium">What happens next</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>We review your details and documents.</li>
          <li>We get in touch if we need anything more.</li>
          <li>Submitting is not an approval. We tell you our decision when the review is done.</li>
        </ul>
      </div>
      <Link href={`/apply/${token}/track`} className="inline-block text-sm font-medium text-brand-orange underline-offset-4 hover:underline">
        Check your application status
      </Link>
    </div>
  );
}
