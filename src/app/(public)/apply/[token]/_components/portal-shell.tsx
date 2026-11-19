"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import type { PublicApplicationPortal } from "@/types/loan-origination";

/** The organization's name and logo above a centered column, with its contact details below. */
export function PortalShell({ portal, children }: { portal: PublicApplicationPortal | null; children: ReactNode }) {
  const org = portal?.organization;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {org?.logo_url && (
            // `unoptimized`: the API's own file, served as it is (next.config.ts allows no remote image hosts).
            <span className="relative inline-block h-9 w-9 shrink-0">
              <Image src={org.logo_url} alt="" fill unoptimized className="rounded object-contain" />
            </span>
          )}
          <span className="font-semibold">{org?.name ?? "Loan application"}</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:py-10">{children}</main>
      {org && (org.contact_phone || org.contact_email || org.address) && (
        <footer className="border-t bg-white">
          <div className="mx-auto max-w-3xl px-4 py-4 text-xs text-muted-foreground">
            Questions? {[org.contact_phone, org.contact_email, org.address].filter(Boolean).join(" · ")}
          </div>
        </footer>
      )}
    </div>
  );
}

export function PortalLoading() {
  return (
    <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
    </p>
  );
}

export function PortalError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border bg-card p-6 text-center">
      <h1 className="text-lg font-semibold">This link is not available</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
