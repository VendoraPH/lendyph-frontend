"use client";

import { useCallback } from "react";
import { DataState } from "@/components/common/data-state";
import { useApiResource } from "@/hooks";
import { creditScoringService } from "@/services";
import { RiskLevelBadge } from "../../_components/risk-level-badge";
import { ConfidenceBadge } from "../../_components/confidence-badge";
import { ScoreBreakdownCard } from "../../_components/score-breakdown-card";
import { ScoreFactorList } from "../../_components/score-factor-list";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { CreditScore } from "@/types/credit-scoring";

/**
 * Self-contained by design: takes only a `borrowerId` and renders the full
 * assessment. This is a standalone page today (`/credit-scoring/assessment`)
 * but the shape is deliberately drop-in-ready for embedding into the new
 * loan application flow (`loans/new/page.tsx`) in a future PR — that embed
 * is explicitly out of scope here.
 */
export function CreditAssessmentPanel({ borrowerId }: { borrowerId: number }) {
  const fetcher = useCallback(
    () => creditScoringService.getBorrowerCreditProfile(borrowerId),
    [borrowerId],
  );
  const resource = useApiResource<CreditScore>(fetcher);

  return (
    <DataState
      resource={resource}
      summary="A fresh credit assessment for this borrower will appear here once the backend is connected."
      endpoints={[`GET /credit-scoring/borrowers/${borrowerId}`]}
    >
      {(profile) => (
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-4 pt-6">
              <div>
                <p className="text-3xl font-semibold">{profile.score}</p>
                <p className="text-xs text-muted-foreground">out of 100</p>
              </div>
              <RiskLevelBadge level={profile.risk_level} />
              <ConfidenceBadge level={profile.confidence} />
              <span className="text-xs text-muted-foreground">
                {formatDateTime(profile.calculated_at)}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium">System Recommendation</p>
              <p className="mt-1 text-sm text-muted-foreground">{profile.recommendation}</p>
            </CardContent>
          </Card>
          <ScoreBreakdownCard breakdown={profile.category_breakdown} />
          <ScoreFactorList factors={profile.factors} />
        </div>
      )}
    </DataState>
  );
}
