"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hasIllustration, Illustration } from "@/components/common/illustration";

/**
 * The app's last-resort error screen, for a page that failed while rendering.
 * It never shows the error's own text (users never see raw errors); a server
 * error's reference (`digest`) is shown so support can find it in the logs.
 * "Try again" re-renders the failed page.
 */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="flex max-w-md flex-col items-center text-center">
        {hasIllustration("error") ? (
          <Illustration name="error" className="mb-6" />
        ) : (
          <div className="mb-6 rounded-full bg-destructive/10 p-4">
            <AlertCircle className="size-12 text-destructive" aria-hidden="true" />
          </div>
        )}
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Something went wrong</h1>
        <p className="mb-8 text-muted-foreground">
          This page couldn&apos;t be shown. Please try again. If it keeps happening, contact your administrator.
        </p>
        <Button variant="outline" onClick={() => retry()}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
        {digest ? <p className="mt-6 text-xs text-muted-foreground">Reference: {digest}</p> : null}
      </div>
    </main>
  );
}
