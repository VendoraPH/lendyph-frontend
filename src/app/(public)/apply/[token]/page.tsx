"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ApplicantSession, Submitted } from "@/types/public-application";
import { Confirmation } from "./_components/confirmation";
import { Landing } from "./_components/landing";
import { OtpVerify } from "./_components/otp-verify";
import { PortalError, PortalLoading, PortalShell } from "./_components/portal-shell";
import { Wizard } from "./_components/wizard";
import { usePortal } from "./_hooks/use-portal";

type Mode =
  | { kind: "landing"; notice: string | null }
  | { kind: "resume"; notice: string | null; mobile: string }
  | { kind: "wizard"; session: ApplicantSession | null; mobile: string }
  | { kind: "done"; result: Submitted | null; already: boolean };

const SIGNED_OUT = "You signed out. Your answers are saved: continue any time with a new code.";

/**
 * The public loan application: landing, then an eight-step wizard that saves
 * as the applicant goes, then a reference number. The session lives only in
 * memory; a returning applicant verifies their mobile again to resume. A
 * session that ends asks for a new code, a link that stops taking
 * applications shows why, and signing out always works.
 */
export default function ApplyPage() {
  const { token } = useParams<{ token: string }>();
  const { portal, error, loading, reload } = usePortal(token);
  const [mode, setMode] = useState<Mode>({ kind: "landing", notice: null });

  const content = () => {
    if (loading) return <PortalLoading />;
    if (!portal) return <PortalError message={error ?? "This application link could not be opened."} />;
    switch (mode.kind) {
      case "landing":
        return (
          <Landing
            token={token}
            portal={portal}
            notice={mode.notice}
            onStart={() => setMode({ kind: "wizard", session: null, mobile: "" })}
            onResume={() => setMode({ kind: "resume", notice: null, mobile: "" })}
          />
        );
      case "resume":
        return (
          <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
            <div>
              <h1 className="text-xl font-semibold">Continue your application</h1>
              <p className="text-sm text-muted-foreground">Enter the mobile number you applied with. We text a code to confirm it is you.</p>
            </div>
            {mode.notice && (
              <p className="rounded-lg border bg-muted/40 p-3 text-sm" role="status">
                {mode.notice}
              </p>
            )}
            <OtpVerify
              token={token}
              purpose="resume"
              initialMobile={mode.mobile}
              onVerified={(session, mobile) => setMode({ kind: "wizard", session, mobile })}
            />
            <Button variant="link" className="h-auto p-0" onClick={() => setMode({ kind: "landing", notice: null })}>
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
            initialMobile={mode.mobile}
            onDone={(result, already) => setMode({ kind: "done", result, already })}
            onSessionEnded={(notice, mobile) => setMode({ kind: "resume", notice, mobile })}
            onLinkClosed={() => {
              reload();
              setMode({ kind: "landing", notice: null });
            }}
            onSignedOut={() => setMode({ kind: "landing", notice: SIGNED_OUT })}
          />
        );
      case "done":
        return <Confirmation token={token} result={mode.result} already={mode.already} />;
    }
  };

  return <PortalShell portal={portal}>{content()}</PortalShell>;
}
