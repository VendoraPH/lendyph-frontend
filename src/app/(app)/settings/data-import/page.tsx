import { Suspense } from "react";
import type { Metadata } from "next";

import { RouteGuard } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { DataImportView } from "./_components/data-import-view";

export const metadata: Metadata = {
  title: "Data Import",
};

/**
 * Stands in for the wizard until the client takes over.
 *
 * Deliberately not a skeleton of step 1. The first thing the wizard does is
 * check whether an import is already running, and a page that flashes an empty
 * "start a new import" form first tells a returning admin the opposite of what
 * is about to be true.
 */
function WizardFallback() {
  return (
    <Card>
      <CardContent className="space-y-4 py-6">
        <p className="text-base font-semibold">
          Checking for an import in progress…
        </p>
        <Skeleton className="h-1 w-full max-w-md" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-64" />
          <Skeleton className="h-3 w-72" />
          <Skeleton className="h-3 w-56" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * `/settings/data-import`.
 *
 * A Server Component on purpose, and the only one of the two things it does is
 * the `<Suspense>` boundary. `DataImportView` reaches `useSearchParams` through
 * the reattach hook, and per
 * `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`
 * an unwrapped call forces the client tree up to the NEAREST boundary to be
 * client-rendered — with no boundary that is the whole route, and a static
 * build fails outright with "Missing Suspense boundary with useSearchParams".
 * `loans/page.tsx` calls it unwrapped today and gets away with it only because
 * that page is `"use client"` end to end; it is not a pattern to copy.
 *
 * The boundary sits below the heading so the heading and the guard still
 * prerender, which is the arrangement the doc recommends.
 *
 * The gate is `imports:process`: the permission the backend migration added,
 * granted to `super_admin` and `admin` only. It is checked against
 * `user.permissions` as the server sent them — the `ROLES` map in
 * `@/constants/rbac` documents the same grant for the roles screen but grants
 * nothing itself.
 */
export default function DataImportPage() {
  return (
    <RouteGuard permission="imports:process" pageName="Data Import">
      <div className="mx-auto max-w-4xl space-y-4">
        <header>
          <h1 className="text-2xl font-semibold">Data Import</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bring an existing member and loan book into Lendyph from CSV. This
            creates real members and real loans — it is not a preview, and there
            is no undo, so work through the checks before uploading.
          </p>
        </header>

        <Suspense fallback={<WizardFallback />}>
          <DataImportView />
        </Suspense>
      </div>
    </RouteGuard>
  );
}
