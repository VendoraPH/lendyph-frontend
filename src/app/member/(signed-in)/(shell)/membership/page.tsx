"use client";

import { useCallback } from "react";
import { DetailList } from "@/components/portal/detail-list";
import { LoadState } from "@/components/portal/load-state";
import { Money } from "@/components/portal/money";
import { PortalPageHeader } from "@/components/portal/page-header";
import { SectionCard } from "@/components/portal/section-card";
import { StatusPill } from "@/components/portal/status-pill";
import { formatDate } from "@/lib/format";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import {
  MEMBER_STATUS,
  MEMBER_STATUS_TONE,
  MEMBER_TYPE,
  NONE,
  STANDING_STATUS,
  STANDING_STATUS_TONE,
  labelOf,
} from "@/lib/portal/labels";
import { portalService } from "@/lib/portal/portal-api";

/**
 * Membership: the member's number, type, status and branch, and the factual
 * standing of each area. There is no overall "good standing" label until the
 * cooperative defines one (portal design §13.2).
 */
export default function MembershipPage() {
  const fetcher = useCallback(() => portalService.membership(), []);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load your membership. Please try again.");

  return (
    <>
      <PortalPageHeader title="Membership" />
      <LoadState loading={loading} error={error} onRetry={reload}>
        {data && (
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Your membership">
              <DetailList
                items={[
                  { label: "Member number", value: data.member_number, strong: true },
                  { label: "Member type", value: labelOf(MEMBER_TYPE, data.member_type) },
                  { label: "Status", value: <StatusPill value={data.status} labels={MEMBER_STATUS} tones={MEMBER_STATUS_TONE} /> },
                  { label: "Member since", value: data.membership_date ? formatDate(data.membership_date) : NONE },
                ]}
              />
            </SectionCard>
            <SectionCard title="Your branch">
              <DetailList
                items={[
                  { label: "Branch", value: data.branch.name ?? NONE },
                  { label: "Address", value: data.branch.address ?? NONE },
                  { label: "Contact number", value: data.branch.contact_number ?? NONE },
                  { label: "Portal help", value: data.support_contact ?? NONE },
                ]}
              />
            </SectionCard>
            {data.standing.length > 0 && (
              <SectionCard title="Your accounts at a glance">
                <ul className="divide-y">
                  {data.standing.map((line) => (
                    <li key={line.key} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="text-sm">{line.label}</span>
                      <span className="flex items-center gap-2">
                        {line.amount !== null && <Money value={line.amount} className="text-sm" />}
                        <StatusPill value={line.status} labels={STANDING_STATUS} tones={STANDING_STATUS_TONE} />
                      </span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}
          </div>
        )}
      </LoadState>
    </>
  );
}
