"use client";

import { ErrorScreen } from "@/components/common/error-screen";

/**
 * The error screen for a page inside the app shell: a page that fails while
 * rendering shows this in place of its content, so the side menu and header
 * stay and the user can move on. `app/error.tsx` covers anything outside the
 * shell.
 */
export default function AppPageError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <ErrorScreen error={error} retry={retry} />
    </div>
  );
}
