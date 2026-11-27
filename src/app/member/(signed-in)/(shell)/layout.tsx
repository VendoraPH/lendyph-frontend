"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { PortalShell } from "@/components/portal/portal-shell";
import { usePortalSession } from "@/lib/portal/portal-session";

/** The member's pages, inside the shell. While new terms are owed, the member goes to them first. */
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const member = usePortalSession((s) => s.member);
  const termsRequired = usePortalSession((s) => s.termsRequired);

  useEffect(() => {
    if (termsRequired) router.replace("/member/terms");
  }, [termsRequired, router]);

  if (!member || termsRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  return <PortalShell member={member}>{children}</PortalShell>;
}
