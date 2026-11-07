"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { useIsClient } from "@/hooks/use-is-client";
import { isTokenExpired } from "@/lib/session-token";
import { PORTAL_SESSION_ENDED_EVENT, portalTokens } from "@/lib/portal/portal-client";
import { usePortalSession } from "@/lib/portal/portal-session";
import { portalService } from "@/services/portal.service";
import { PortalShell } from "../_components/portal-shell";

/** How often to notice that the member's session ran out while the tab sat open. */
const EXPIRY_CHECK_MS = 30_000;

function hasLiveToken(): boolean {
  return portalTokens.get() !== null && !isTokenExpired(portalTokens.lifetime(), Date.now());
}

/**
 * Every signed-in /member screen. Client-side gate only, like the staff app:
 * the API refuses a missing or expired member token whatever this renders.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isClient = useIsClient();
  const member = usePortalSession((s) => s.member);
  const setMember = usePortalSession((s) => s.setMember);
  const signOut = usePortalSession((s) => s.signOut);
  const signedIn = isClient && member !== null && hasLiveToken();

  useEffect(() => {
    if (isClient && !signedIn) {
      signOut();
      router.replace("/member/login");
    }
  }, [isClient, signedIn, signOut, router]);

  // Refresh the member's name and details once per visit.
  useEffect(() => {
    if (!signedIn) return;
    portalService
      .me()
      .then(setMember)
      .catch(() => {
        // A 401 is handled by the client's interceptor; anything else keeps
        // the details from sign-in.
      });
  }, [signedIn, setMember]);

  useEffect(() => {
    if (!signedIn) return;
    const end = () => {
      signOut();
      router.replace("/member/login");
    };
    const onEnded = () => end();
    window.addEventListener(PORTAL_SESSION_ENDED_EVENT, onEnded);
    const timer = window.setInterval(() => {
      if (!hasLiveToken()) end();
    }, EXPIRY_CHECK_MS);
    return () => {
      window.removeEventListener(PORTAL_SESSION_ENDED_EVENT, onEnded);
      window.clearInterval(timer);
    };
  }, [signedIn, signOut, router]);

  if (!signedIn || !member) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return <PortalShell member={member}>{children}</PortalShell>;
}
