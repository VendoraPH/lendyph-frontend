"use client";

import { useCallback } from "react";
import Link from "next/link";
import { LoadState } from "@/components/portal/load-state";
import { PortalPageHeader } from "@/components/portal/page-header";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { portalService } from "@/lib/portal/portal-api";
import { DashboardCards } from "./_components/dashboard-cards";
import { DashboardLists } from "./_components/dashboard-lists";

/** Home: the member's figures at a glance, every one from `/portal/dashboard` (portal design §3). */
export default function MemberDashboardPage() {
  const fetcher = useCallback(() => portalService.dashboard(), []);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load your summary. Please try again.");

  return (
    <>
      <PortalPageHeader
        title={data ? `Hello, ${data.member.first_name}` : "Welcome"}
        description={
          data ? (
            <>
              Member number {data.member.member_number}
              {data.member.branch_name ? ` · ${data.member.branch_name}` : ""}
            </>
          ) : undefined
        }
      />
      <LoadState loading={loading} error={error} onRetry={reload}>
        {data && (
          <div className="space-y-6">
            {data.pending_requests > 0 && (
              <p className="rounded-lg border bg-card px-4 py-3 text-sm">
                You have {data.pending_requests === 1 ? "1 open request" : `${data.pending_requests} open requests`}.{" "}
                <Link href="/member/requests" className="font-medium text-primary underline-offset-4 hover:underline">
                  See requests
                </Link>
              </p>
            )}
            <DashboardCards data={data} />
            <DashboardLists data={data} />
          </div>
        )}
      </LoadState>
    </>
  );
}
