"use client";

import { ChangePasswordCard } from "../../_components/change-password-card";
import { PortalPageHeader } from "../../_components/portal-shell";
import { SessionsCard } from "../../_components/sessions-card";
import { LoginHistoryCard } from "../../_components/login-history-card";

export default function MemberSecurityPage() {
  return (
    <>
      <PortalPageHeader title="Security" description="Your password, signed-in devices and recent sign-ins." />
      <div className="grid gap-5 lg:grid-cols-2">
        <ChangePasswordCard />
        <SessionsCard />
        <div className="lg:col-span-2">
          <LoginHistoryCard />
        </div>
      </div>
    </>
  );
}
