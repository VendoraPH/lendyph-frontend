// src/app/(app)/credit-scoring/borrowers/[id]/page.tsx

"use client";

import { use, useCallback, useState } from "react";
import { RouteGuard } from "@/components/common/route-guard";
import { PermissionGate } from "@/components/common/permission-gate";
import { DataState } from "@/components/common/data-state";
import { useApiResource } from "@/hooks";
import { creditScoringService } from "@/services";
import { CreditScoringPageHeader } from "../../_components/page-header";
import { ScoreDetail } from "../../_components/score-detail";
import { CapacitySection } from "../../_components/capacity-section";
import { PolicyFlagAlert } from "../../_components/policy-flag-alert";
import { ScoreHistoryChart } from "./_components/score-history-chart";
import { MemberScoreHistory } from "./_components/member-score-history";
import { MemberDecisions } from "./_components/member-decisions";
import { ManualOverrideDialog } from "./_components/manual-override-dialog";
import { LindaChatPlaceholder } from "./_components/linda-chat-placeholder";
import { CicPlaceholder } from "./_components/cic-placeholder";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SCORE_TYPE_LABELS } from "@/lib/credit-scoring/labels";
import { env } from "@/config/env";
import { isDetailsHidden } from "@/lib/credit-scoring/score-state";
import type { CreditScore, PolicyFlagList } from "@/types/credit-scoring";

function BorrowerCreditProfileContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const borrowerId = Number(id);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [decisionsVersion, setDecisionsVersion] = useState(0);

  const profileFetcher = useCallback(
    () => creditScoringService.getBorrowerCreditProfile(borrowerId),
    [borrowerId],
  );
  const profileResource = useApiResource<CreditScore>(profileFetcher);

  const flagsFetcher = useCallback(
    () => creditScoringService.listPolicyFlags(borrowerId),
    [borrowerId],
  );
  const flagsResource = useApiResource<PolicyFlagList>(flagsFetcher);

  return (
    <div className="space-y-6">
      <DataState
        resource={profileResource}
        summary="This member's credit score, breakdown and factors."
        endpoints={[`GET /credit-scoring/borrowers/${borrowerId}`]}
      >
        {(profile) => {
          const summaryOnly = isDetailsHidden(profile, flagsResource.data);
          return (
            <>
              <CreditScoringPageHeader
                title={profile.borrower_name}
                description={[
                  profile.borrower_code,
                  "Lendy Credit Score",
                  profile.score_type ? SCORE_TYPE_LABELS[profile.score_type] : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                actions={
                  profile.id !== null && (
                    <PermissionGate permission="credit_scoring:override">
                      <Button onClick={() => setOverrideOpen(true)}>Record Decision</Button>
                    </PermissionGate>
                  )
                }
              />

              {summaryOnly ? null : flagsResource.unavailable || flagsResource.error ? (
                <Card>
                  <CardContent className="pt-6 text-sm text-muted-foreground">
                    Policy flags unavailable — this member&apos;s hard-flag status
                    could not be loaded. Treat this member as unscreened for hard
                    flags until this is resolved.
                  </CardContent>
                </Card>
              ) : (
                flagsResource.data &&
                flagsResource.data.data.length > 0 && <PolicyFlagAlert flags={flagsResource.data.data} />
              )}

              <ScoreDetail score={profile} detailsHidden={summaryOnly} />

              {!summaryOnly && profile.status !== "not_scored" && (
                <Card>
                  <CardContent className="pt-6">
                    <CapacitySection capacity={profile.capacity ?? null} financialsHidden={profile.financials_hidden} />
                  </CardContent>
                </Card>
              )}

              <ScoreHistoryChart borrowerId={borrowerId} />
              <MemberDecisions key={decisionsVersion} borrowerId={borrowerId} />
              <MemberScoreHistory borrowerId={borrowerId} />

              <div className="grid gap-4 sm:grid-cols-2">
                {env.features.linda && <LindaChatPlaceholder />}
                <CicPlaceholder />
              </div>

              {profile.id !== null && (
                <ManualOverrideDialog
                  open={overrideOpen}
                  onOpenChange={setOverrideOpen}
                  borrowerId={borrowerId}
                  creditScoreId={profile.id}
                  onDecisionRecorded={() => {
                    profileResource.refetch();
                    setDecisionsVersion((v) => v + 1);
                  }}
                />
              )}
            </>
          );
        }}
      </DataState>
    </div>
  );
}

export default function BorrowerCreditProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RouteGuard permission="credit_scoring:view" pageName="Member Credit Profile">
      <BorrowerCreditProfileContent params={params} />
    </RouteGuard>
  );
}
