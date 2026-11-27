"use client";

import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortalConfig } from "./portal-config";
import { PortalLogo } from "./portal-logo";

/** The frame of the sign-in, code and terms pages: centred, phone first. */
export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const { name } = usePortalConfig();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
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
