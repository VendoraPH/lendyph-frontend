"use client";

import { useCallback } from "react";
import { CheckCircle2, CircleAlert, MinusCircle } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatCurrency, formatDate } from "@/lib/format";
import { humanize, membershipTone, TONE_CLASS } from "@/lib/portal/labels";
import { portalService } from "@/services/portal.service";
import type { PortalBranch, PortalMembership, StandingValue } from "@/types/portal";
import { CreditScoreCard } from "../../_components/credit-score-card";
import { DetailItem as Item } from "../../_components/detail-item";
import { PortalPageHeader, StatusPill } from "../../_components/portal-shell";

const STANDING_ICON: Record<StandingValue, { icon: typeof CheckCircle2; className: string }> = {
  good: { icon: CheckCircle2, className: "text-emerald-600" },
  attention: { icon: CircleAlert, className: "text-amber-600" },
  not_applicable: { icon: MinusCircle, className: "text-muted-foreground" },
};

export default function MembershipPage() {
  const fetcher = useCallback(() => portalService.membership(), []);
  const resource = useApiResource(fetcher);
  return (
    <>
      <PortalPageHeader title="My membership" description="Your membership details and standing." />
      <DataState
        resource={resource}
        endpoints={["GET /portal/membership"]}
        summary="Your membership details will show here once online access is connected."
      >
        {(data) => <MembershipBody data={data} />}
      </DataState>
    </>
  );
}

function MembershipBody({ data }: { data: PortalMembership }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Membership</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Item label="Membership number" value={data.member_number} />
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <StatusPill className={TONE_CLASS[membershipTone(data.status)]}>{humanize(data.status)}</StatusPill>
              </dd>
            </div>
            <Item label="Type" value={data.membership_type} />
            <Item label="Category" value={data.membership_category} />
            <Item label="Date joined" value={data.date_joined ? formatDate(data.date_joined) : null} />
            <Item label="Account standing" value={data.account_standing} />
            {data.share_capital !== null && <Item label="Share capital" value={formatCurrency(data.share_capital)} />}
          </dl>
        </CardContent>
      </Card>

      {data.branch && <BranchCard branch={data.branch} />}

      <CreditScoreCard />

      {data.standing.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Standing</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {data.standing.map((s) => {
                const { icon: Icon, className } = STANDING_ICON[s.state] ?? STANDING_ICON.not_applicable;
                return (
                  <li key={s.key} className="flex items-start gap-2 text-sm">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} aria-hidden />
                    <span className="flex-1">{s.label}</span>
                    <span className="text-muted-foreground">{s.value}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {data.requirements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Membership requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {data.requirements.map((r) => (
                <li key={r.key} className="flex items-start gap-2 text-sm">
                  {r.complete ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Complete" />
                  ) : (
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-label="Incomplete" />
                  )}
                  <div>
                    <p>{r.label}</p>
                    {r.detail && <p className="text-xs text-muted-foreground">{r.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BranchCard({ branch }: { branch: PortalBranch }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your branch</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-y-3 text-sm sm:grid-cols-2 sm:gap-x-4">
          <Item label="Branch" value={branch.name} />
          <Item label="Address" value={branch.address} />
          <Item label="Contact number" value={branch.contact_number} />
          <Item label="Email" value={branch.email} />
          <Item label="Office hours" value={branch.office_hours} />
          <Item label="Contact person" value={branch.contact_person} />
        </dl>
      </CardContent>
    </Card>
  );
}
