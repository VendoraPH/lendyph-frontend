"use client";

import { ErrorScreen } from "@/components/common/error-screen";

/**
 * The app's last-resort error screen, for a page outside the app shell that
 * failed while rendering (sign-in, the member portal). Pages inside the shell
 * use `app/(app)/error.tsx`, which keeps the side menu and header.
 */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <ErrorScreen error={error} retry={retry} />
    </main>
  );
}
