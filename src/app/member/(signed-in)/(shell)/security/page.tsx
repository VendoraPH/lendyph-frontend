"use client";

import { useRef, useState } from "react";
import { PortalPageHeader } from "@/components/portal/page-header";
import { ChangePasswordCard } from "./_components/change-password-card";
import { LoginHistoryCard } from "./_components/login-history-card";
import { SessionsCard } from "./_components/sessions-card";

/**
 * Security (carried over from #511 by Augustin): where the member is signed
 * in, recent sign-ins with "This wasn't me", and the password change.
 */
export default function SecurityPage() {
  const passwordRef = useRef<HTMLDivElement>(null);
  const [askForPassword, setAskForPassword] = useState(false);
  const [sessionsVersion, setSessionsVersion] = useState(0);

  const onReported = () => {
    setAskForPassword(true);
    setSessionsVersion((n) => n + 1);
    passwordRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    passwordRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  };

  return (
    <>
      <PortalPageHeader title="Security" description="Keep your account safe. Never share your password or the code from your branch." />
      <div className="grid gap-4 lg:grid-cols-2">
        <SessionsCard key={sessionsVersion} />
        <LoginHistoryCard onReported={onReported} />
        <div ref={passwordRef} className="scroll-mt-20 lg:col-span-2">
          <ChangePasswordCard urgent={askForPassword} onChanged={() => setSessionsVersion((n) => n + 1)} />
        </div>
      </div>
    </>
  );
}
