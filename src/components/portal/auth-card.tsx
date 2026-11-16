"use client";

import type { ReactNode } from "react";
import { Illustration } from "@/components/common/illustration";
import type { IllustrationName } from "@/lib/illustrations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortalConfig } from "./portal-config";
import { PortalLogo } from "./portal-logo";

/**
 * The frame of the sign-in, code and terms pages: centred, phone first.
 * `illustration` puts that slot's picture above the card on wide screens,
 * once it is set in `@/lib/illustrations`; until then nothing changes.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
  illustration,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  illustration?: IllustrationName;
}) {
  const { name } = usePortalConfig();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      {illustration ? (
        <Illustration name={illustration} className="mb-6 hidden max-h-[min(12rem,22dvh)] lg:block" />
      ) : null}
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <PortalLogo size="lg" align="center" />
        <p className="text-sm font-semibold">{name}</p>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">
            <h1>{title}</h1>
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      {footer && <div className="mt-4 w-full max-w-md text-center text-sm text-muted-foreground">{footer}</div>}
    </main>
  );
}
