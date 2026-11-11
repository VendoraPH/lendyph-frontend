"use client";

import { useCallback } from "react";
import { DetailList } from "@/components/portal/detail-list";
import { LoadState } from "@/components/portal/load-state";
import { Money } from "@/components/portal/money";
import { PortalPageHeader } from "@/components/portal/page-header";
import { SectionCard } from "@/components/portal/section-card";
import { formatDate } from "@/lib/format";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { NONE } from "@/lib/portal/labels";
import { featureOn } from "@/lib/portal/nav";
import { portalService } from "@/lib/portal/portal-api";
import { usePortalSession } from "@/lib/portal/portal-session";
import { ShareCapitalDocuments } from "./_components/share-capital-documents";
import { ShareCapitalHistory } from "./_components/share-capital-history";

/** Share capital: the paid-up figure, the pledge, the entries with the server's running balance, and the PDFs. */
export default function ShareCapitalPage() {
  const features = usePortalSession((s) => s.features);
  const fetcher = useCallback(() => portalService.shareCapital(), []);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load your share capital. Please try again.");

  return (
    <>
      <PortalPageHeader title="Share Capital" />
      <div className="space-y-4">
        <LoadState loading={loading} error={error} onRetry={reload}>
          {data && (
            <SectionCard title="Your share capital">
              <DetailList
                items={[
                  { label: "Paid up", value: <Money value={data.paid_up} />, strong: true },
                  { label: "Pledged", value: <Money value={data.pledged} /> },
                  { label: "Still to pay on your pledge", value: <Money value={data.remaining_pledge} /> },
                  { label: "All contributions", value: <Money value={data.total_contributions} /> },
                  {
                    label: "Last contribution",
                    value: data.last_contribution ? (
                      <>
                        <Money value={data.last_contribution.amount} /> on {formatDate(data.last_contribution.date)}
                      </>
                    ) : (
                      NONE
                    ),
                  },
                ]}
              />
            </SectionCard>
          )}
        </LoadState>
        {featureOn(features, "statements") && <ShareCapitalDocuments />}
        <ShareCapitalHistory />
      </div>
    </>
  );
}
