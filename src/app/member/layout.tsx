import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/config/env";
import { PortalConfigProvider } from "@/components/portal/portal-config";

export const metadata: Metadata = {
  title: { default: "Member Portal", template: "%s | Member Portal" },
  description: "Your membership, loans, savings and share capital.",
  referrer: "same-origin",
};

/**
 * The Member Portal (carried over from #511 by Augustin). Off unless the
 * build sets NEXT_PUBLIC_ENABLE_MEMBER_PORTAL: then every /member route is a
 * plain 404, rendered on the server before any portal code runs, so nothing
 * calls the API. The /member security headers are in next.config.ts.
 */
export default function MemberLayout({ children }: { children: React.ReactNode }) {
  if (!env.features.memberPortal) notFound();
  return (
    <div className="min-h-screen bg-[#f4f6f9] dark:bg-background">
      <PortalConfigProvider>{children}</PortalConfigProvider>
    </div>
  );
}
