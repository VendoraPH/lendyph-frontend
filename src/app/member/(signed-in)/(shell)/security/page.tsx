"use client";

import { useRef, useState } from "react";
import { PageFill } from "@/components/common/page-fill";
import { PortalPageHeader } from "@/components/portal/page-header";
import { ChangePasswordCard } from "./_components/change-password-card";
import { LoginHistoryCard } from "./_components/login-history-card";
import { SessionsCard } from "./_components/sessions-card";

/**
 * Security (carried over from #511 by Augustin): where the member is signed
 * in, recent sign-ins with "This wasn't me", and the password change. From
 * `lg` the three cards sit side by side; at the `fit:` size they share the
 * height under the heading and each one scrolls inside itself.
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
    <PageFill className="gap-5">
      <PortalPageHeader title="Security" description="Keep your account safe. Never share your password or the code from your branch." />
      <div className="grid gap-4 lg:grid-cols-3 fit:min-h-0 fit:flex-1 fit:grid-rows-[minmax(0,1fr)]">
        <SessionsCard key={sessionsVersion} />
        <LoginHistoryCard onReported={onReported} />
        <div ref={passwordRef} className="flex scroll-mt-4 flex-col fit:min-h-0">
          <ChangePasswordCard urgent={askForPassword} onChanged={() => setSessionsVersion((n) => n + 1)} />
        </div>
      </div>
    </PageFill>
  );
}
