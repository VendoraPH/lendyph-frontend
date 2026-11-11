"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AuthCard } from "@/components/portal/auth-card";
import { TermsConsent } from "@/components/portal/terms-consent";
import { useConfirmedSubmit } from "@/lib/portal/hooks/use-confirmed-submit";
import { portalService } from "@/lib/portal/portal-api";
import { usePortalSession } from "@/lib/portal/portal-session";
import { CONFIRMS } from "@/lib/portal/server-confirm";

/**
 * The updated terms, before anything else (portal design §1): while the
 * server answers `terms_required`, every page but this one is held. Accepting
 * names the version the member read; the server refuses an older one.
 */
export default function TermsPage() {
  const router = useRouter();
  const setTermsRequired = usePortalSession((s) => s.setTermsRequired);
  const signOut = usePortalSession((s) => s.signOut);
  const { submitting, submit } = useConfirmedSubmit();
  const [accepted, setAccepted] = useState(false);
  const [consent, setConsent] = useState(false);

  const accept = (version: string) =>
    submit(() => portalService.acceptTerms(version, consent), {
      expect: CONFIRMS.done,
      success: "Thank you. The updated terms are accepted.",
      failure: "We couldn't save your acceptance. Please try again.",
      onConfirmed: () => {
        setTermsRequired(false);
        router.replace("/member");
      },
    });

  const leave = () => {
    portalService
      .logout()
      .catch(() => undefined)
      .then(() => {
        signOut();
        router.replace("/member/login");
      });
  };

  return (
    <AuthCard title="Updated terms" description="Please read and accept the updated terms to keep using the portal.">
      <TermsConsent accepted={accepted} onAccepted={setAccepted} consent={consent} onConsent={setConsent}>
        {(terms) => (
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button className="h-10 flex-1" disabled={!accepted || submitting} onClick={() => accept(terms.version)}>
              {submitting && <Spinner className="h-4 w-4" />}
              Accept and continue
            </Button>
            <Button variant="outline" className="h-10 flex-1" onClick={leave} disabled={submitting}>
              Sign out
            </Button>
          </div>
        )}
      </TermsConsent>
    </AuthCard>
  );
}
