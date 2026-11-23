"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import type { PublicPortal } from "@/types/public-application";

/**
 * The organization's name and logo above the page, its contact details below.
 * At the `fit:` size (1024 x 640 and up) the frame is the window's height: the
 * header and footer stay put and only the page scrolls, inside `<main>` or
 * inside the wizard's own step box. Below it the page scrolls as usual.
 */
export function PortalShell({ portal, children }: { portal: PublicPortal | null; children: ReactNode }) {
  const org = portal?.organization;
  return (
    <div className="flex min-h-dvh flex-col bg-muted/20 fit:h-dvh fit:overflow-hidden">
      <header className="shrink-0 border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          {org?.logo_url && (
            // `unoptimized`: the API's own file, served as it is (next.config.ts allows no remote image hosts).
            <span className="relative inline-block h-9 w-9 shrink-0">
              <Image src={org.logo_url} alt="" fill unoptimized className="rounded object-contain" />
            </span>
          )}
          <span className="font-semibold">{org?.name ?? "Loan application"}</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 fit:min-h-0 fit:overflow-y-auto sm:py-8">{children}</main>
      {org && (org.contact_phone || org.contact_email || org.address) && (
        <footer className="shrink-0 border-t bg-card">
          <div className="mx-auto max-w-5xl px-4 py-3 text-xs text-muted-foreground">
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
