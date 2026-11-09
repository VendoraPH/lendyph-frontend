"use client";

import { useCallback } from "react";
import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { useApiResource } from "@/hooks";
import { creditScoringService } from "@/services";
import { ScoreDetail } from "../../_components/score-detail";
import type { CreditScore } from "@/types/credit-scoring";

/**
 * A member's current score, in every state. A loan application's own
 * assessment lives on the loan page's Credit Assessment card.
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
      summary="This member's current credit score."
      endpoints={[`GET /credit-scoring/borrowers/${borrowerId}`]}
    >
      {(profile) => (
        <div className="space-y-4">
          <p className="text-sm">
            <Link href={`/credit-scoring/borrowers/${borrowerId}`} className="font-medium hover:underline">
              Open {profile.borrower_name}&apos;s credit profile
            </Link>{" "}
            <span className="text-muted-foreground">for score history, flags and decisions.</span>
          </p>
          <ScoreDetail score={profile} />
        </div>
      )}
    </DataState>
  );
}
