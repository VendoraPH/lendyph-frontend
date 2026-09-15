// src/app/(app)/credit-scoring/borrowers/[id]/page.tsx

"use client";

import { use, useCallback, useState } from "react";
import { RouteGuard } from "@/components/common/route-guard";
import { PermissionGate } from "@/components/common/permission-gate";
import { DataState } from "@/components/common/data-state";
import { useApiResource } from "@/hooks";
import { creditScoringService } from "@/services";
import { CreditScoringPageHeader } from "../../_components/page-header";
import { RiskLevelBadge } from "../../_components/risk-level-badge";
import { ConfidenceBadge } from "../../_components/confidence-badge";
import { ScoreBreakdownCard } from "../../_components/score-breakdown-card";
import { ScoreFactorList } from "../../_components/score-factor-list";
import { PolicyFlagAlert } from "../../_components/policy-flag-alert";
import { ManualOverrideDialog } from "./_components/manual-override-dialog";
import { LindaChatPlaceholder } from "./_components/linda-chat-placeholder";
import { CicPlaceholder } from "./_components/cic-placeholder";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { CreditScore, PolicyFlag } from "@/types/credit-scoring";

export default function BorrowerCreditProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const borrowerId = Number(id);
  const [overrideOpen, setOverrideOpen] = useState(false);

  const profileFetcher = useCallback(
    () => creditScoringService.getBorrowerCreditProfile(borrowerId),
    [borrowerId],
  );
  const profileResource = useApiResource<CreditScore>(profileFetcher);

  const flagsFetcher = useCallback(
    () => creditScoringService.listPolicyFlags(borrowerId),
    [borrowerId],
  );
  const flagsResource = useApiResource<PolicyFlag[]>(flagsFetcher);

  return (
    <RouteGuard permission="credit_scoring:view" pageName="Borrower Credit Profile">
      <div className="space-y-6">
        <DataState
          resource={profileResource}
          summary="This borrower's full credit score, breakdown, and factors will appear here once the backend is connected."
          endpoints={[`GET /credit-scoring/borrowers/${borrowerId}`]}
        >
          {(profile) => (
            <>
              <CreditScoringPageHeader
                title={profile.borrower_name}
                description={`Lendy Credit Score · ${profile.score_type === "application" ? "Application Score" : "Behavioral Score"}`}
                actions={
                  <PermissionGate permission="credit_scoring:override">
                    <Button onClick={() => setOverrideOpen(true)}>Record Decision</Button>
                  </PermissionGate>
                }
              />

              <Card>
                <CardContent className="flex flex-wrap items-center gap-4 pt-6">
                  <div>
                    <p className="text-3xl font-semibold">{profile.score}</p>
                    <p className="text-xs text-muted-foreground">out of 100</p>
                  </div>
                  <RiskLevelBadge level={profile.risk_level} />
                  <ConfidenceBadge level={profile.confidence} />
                  <span className="text-xs text-muted-foreground">
                    Model {profile.model_version} · {formatDateTime(profile.calculated_at)}
                  </span>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm font-medium">System Recommendation</p>
                  <p className="mt-1 text-sm text-muted-foreground">{profile.recommendation}</p>
                </CardContent>
              </Card>

              {flagsResource.data && flagsResource.data.length > 0 && (
                <PolicyFlagAlert flags={flagsResource.data} />
              )}

              <ScoreBreakdownCard breakdown={profile.category_breakdown} />
              <ScoreFactorList factors={profile.factors} />

              <div className="grid gap-4 sm:grid-cols-2">
                <LindaChatPlaceholder />
                <CicPlaceholder />
              </div>

              <ManualOverrideDialog
                open={overrideOpen}
                onOpenChange={setOverrideOpen}
                borrowerId={borrowerId}
                creditScoreId={profile.id}
                onDecisionRecorded={() => profileResource.refetch()}
              />
            </>
          )}
        </DataState>
      </div>
    </RouteGuard>
  );
}
