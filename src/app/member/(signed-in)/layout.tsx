"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { IdleNotice } from "@/components/portal/idle-notice";
import { useIsClient } from "@/hooks/use-is-client";
import { isTokenExpired } from "@/lib/session-token";
import {
  PORTAL_SESSION_ENDED_EVENT,
  PORTAL_TERMS_REQUIRED_EVENT,
  endPortalSession,
  portalTokens,
} from "@/lib/portal/portal-client";
import { portalService } from "@/lib/portal/portal-api";
import { usePortalSession } from "@/lib/portal/portal-session";

/** How often to notice that the session ran past `session_minutes` while the tab sat open. */
const EXPIRY_CHECK_MS = 30_000;

function hasLiveToken(): boolean {
  return portalTokens.get() !== null && !isTokenExpired(portalTokens.lifetime(), Date.now());
}

/**
 * Every signed-in /member page (carried over from #511 by Augustin). A
 * client-side gate, like the staff app's: the API refuses a missing, idle or
 * expired member token whatever this renders. It reloads the member from
 * `/portal/auth/me`, ends the session on the client's event, sends the member
 * to the terms when the server asks, and warns before the idle timeout.
 */
export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isClient = useIsClient();
  const member = usePortalSession((s) => s.member);
  const idleMinutes = usePortalSession((s) => s.idleMinutes);
  const refresh = usePortalSession((s) => s.refresh);
  const setTermsRequired = usePortalSession((s) => s.setTermsRequired);
  const signOut = usePortalSession((s) => s.signOut);
  const signedIn = isClient && member !== null && hasLiveToken();

  useEffect(() => {
    if (isClient && !signedIn) {
      signOut();
      router.replace("/member/login");
    }
  }, [isClient, signedIn, signOut, router]);

  useEffect(() => {
    if (!signedIn) return;
    portalService
      .me()
      .then((me) =>
        refresh(
          { first_name: me.member.first_name, member_number: me.member.member_number, full_name: me.member.full_name, branch_name: me.member.branch_name },
          me.features,
          me.session.idle_minutes,
          me.terms_required,
        ),
      )
      .catch(() => undefined);
  }, [signedIn, refresh]);

  useEffect(() => {
    if (!signedIn) return;
    const onEnded = () => {
      signOut();
      router.replace("/member/login");
    };
    const onTerms = () => {
      setTermsRequired(true);
      router.replace("/member/terms");
    };
    window.addEventListener(PORTAL_SESSION_ENDED_EVENT, onEnded);
    window.addEventListener(PORTAL_TERMS_REQUIRED_EVENT, onTerms);
    const timer = window.setInterval(() => {
      if (!hasLiveToken()) endPortalSession();
    }, EXPIRY_CHECK_MS);
    return () => {
      window.removeEventListener(PORTAL_SESSION_ENDED_EVENT, onEnded);
      window.removeEventListener(PORTAL_TERMS_REQUIRED_EVENT, onTerms);
      window.clearInterval(timer);
    };
  }, [signedIn, signOut, setTermsRequired, router]);

  if (!signedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <>
      {children}
      <IdleNotice idleMinutes={idleMinutes} />
    </>
  );
}
