"use client";

import Link from "next/link";
import { BrandLogo, PoweredByLendy } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { usePortalConfig } from "./portal-config";

interface AuthShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** The centred card every signed-out /member screen sits in. Mobile first. */
export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  const { config, unavailable } = usePortalConfig();
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <BrandLogo className="h-16 w-auto" />
        <p className="text-sm font-medium text-muted-foreground">{config.portal_name}</p>
      </div>
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {unavailable && (
            <p
              role="status"
              className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
            >
              Online access is not connected yet. Your cooperative will tell you when you can sign in.
            </p>
          )}
          {children}
        </CardContent>
      </Card>
      {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
      <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
        {(config.terms_url || config.privacy_url) && (
          <div className="flex gap-4">
            {config.terms_url && (
              <a href={config.terms_url} target="_blank" rel="noreferrer" className="underline">
                Terms of use
              </a>
            )}
            {config.privacy_url && (
              <a href={config.privacy_url} target="_blank" rel="noreferrer" className="underline">
                Privacy notice
              </a>
            )}
          </div>
        )}
        {config.support_contact && <p>Need help? {config.support_contact}</p>}
        <PoweredByLendy />
      </div>
    </main>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-brand-orange underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
