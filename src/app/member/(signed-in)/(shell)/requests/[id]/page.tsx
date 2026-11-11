"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { LoadState } from "@/components/portal/load-state";
import { PortalPageHeader } from "@/components/portal/page-header";
import { SectionCard } from "@/components/portal/section-card";
import { StatusPill } from "@/components/portal/status-pill";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { REQUEST_STATUS, REQUEST_STATUS_TONE, REQUEST_TYPE, labelOf } from "@/lib/portal/labels";
import { portalService } from "@/lib/portal/portal-api";
import { RequestActions } from "../_components/request-actions";
import { RequestDetails } from "../_components/request-details";
import { RequestTimeline } from "../_components/request-timeline";

/** One request: what was asked, its timeline, and cancel or reply while the server allows it. */
export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const requestId = Number(id);
  const fetcher = useCallback(() => portalService.request(requestId), [requestId]);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load this request. Please try again.");

  return (
    <>
      <Link href="/member/requests" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Requests
      </Link>
      <LoadState loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <PortalPageHeader
              title={labelOf(REQUEST_TYPE, data.type)}
              description={
                <span className="inline-flex flex-wrap items-center gap-2">
                  {data.reference}
                  <StatusPill value={data.status} labels={REQUEST_STATUS} tones={REQUEST_STATUS_TONE} />
                </span>
              }
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="What you asked for">
                <RequestDetails request={data} />
              </SectionCard>
              <SectionCard title="Timeline">
                <RequestTimeline events={data.timeline} />
              </SectionCard>
              {(data.can_cancel || data.can_reply) && (
                <div className="lg:col-span-2">
                  <RequestActions request={data} onChanged={reload} />
                </div>
              )}
            </div>
          </>
        )}
      </LoadState>
    </>
  );
}
