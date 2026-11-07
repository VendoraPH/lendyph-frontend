import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/config/env";
import { PortalConfigProvider } from "./_components/portal-config";

export const metadata: Metadata = {
  title: { default: "Member Portal", template: "%s | Member Portal" },
  description: "View your membership, loans, savings and share capital.",
};

/**
 * The member self-service portal. Off unless NEXT_PUBLIC_ENABLE_MEMBER_PORTAL
 * is set, in which case every /member route is a plain 404.
 */
export default function MemberLayout({ children }: { children: React.ReactNode }) {
  if (!env.features.memberPortal) notFound();
  return (
    <div className="min-h-screen bg-[#f4f6f9] dark:bg-background">
      <PortalConfigProvider>{children}</PortalConfigProvider>
    </div>
  );
}
