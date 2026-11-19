"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ApplicationSession, SubmitResult } from "@/types/loan-origination";
import { Confirmation } from "./_components/confirmation";
import { Landing } from "./_components/landing";
import { OtpVerify, type VerifiedContact } from "./_components/otp-verify";
import { PortalError, PortalLoading, PortalShell } from "./_components/portal-shell";
import { Wizard } from "./_components/wizard";
import { usePortal } from "./_hooks/use-portal";

type Mode =
  | { kind: "landing" }
  | { kind: "resume" }
  | { kind: "wizard"; session: ApplicationSession | null; contact: VerifiedContact | null }
  | { kind: "done"; result: SubmitResult };

/**
 * The public loan application: landing, then an eight-step wizard that saves
 * as the applicant goes, then a reference number. The session lives only in
 * memory; a returning applicant verifies their mobile again to resume.
 */
export default function ApplyPage() {
  const { token } = useParams<{ token: string }>();
  const { portal, error, loading } = usePortal(token);
  const [mode, setMode] = useState<Mode>({ kind: "landing" });

  const content = () => {
    if (loading) return <PortalLoading />;
    if (!portal) return <PortalError message={error ?? "This application link could not be opened."} />;
    switch (mode.kind) {
      case "landing":
        return (
          <Landing
            token={token}
            portal={portal}
            onStart={() => setMode({ kind: "wizard", session: null, contact: null })}
            onResume={() => setMode({ kind: "resume" })}
          />
        );
      case "resume":
        return (
          <div className="space-y-4 rounded-xl border bg-white p-4 sm:p-6">
            <div>
              <h1 className="text-xl font-semibold">Continue your application</h1>
              <p className="text-sm text-muted-foreground">Enter the mobile number you applied with. We send a code to confirm it is you.</p>
            </div>
            <OtpVerify
              token={token}
              purpose="resume"
              channels={portal.otp_channels}
              onVerified={(session, contact) => setMode({ kind: "wizard", session, contact })}
            />
            <Button variant="link" className="h-auto p-0" onClick={() => setMode({ kind: "landing" })}>
              Back
            </Button>
          </div>
        );
      case "wizard":
        return (
          <Wizard
            token={token}
            portal={portal}
            initialSession={mode.session}
            initialContact={mode.contact}
            onDone={(result) => setMode({ kind: "done", result })}
          />
        );
      case "done":
        return <Confirmation token={token} result={mode.result} />;
    }
  };

  return <PortalShell portal={portal}>{content()}</PortalShell>;
}
