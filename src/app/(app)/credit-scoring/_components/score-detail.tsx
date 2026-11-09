import { Card, CardContent } from "@/components/ui/card";
import { scoreSections } from "@/lib/credit-scoring/score-state";
import { ScoreSummary } from "./score-summary";
import { ScoreBreakdownCard } from "./score-breakdown-card";
import { ScoreFactorList } from "./score-factor-list";
import { DetailsHiddenNotice } from "./details-hidden-notice";
import type { CreditScore } from "@/types/credit-scoring";

/**
 * A score with its recommendation, breakdown and factors, in every state. A
 * summary-only answer (the score's own `details_hidden`, or `detailsHidden`
 * from the page) shows one notice in place of the breakdown and factors.
 */
export function ScoreDetail({ score, detailsHidden }: { score: CreditScore; detailsHidden?: boolean }) {
  const sections = scoreSections(score, detailsHidden || score.details_hidden === true);
  return (
    <div className="space-y-6">
      <ScoreSummary score={score} />
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium">System Recommendation</p>
          <p className="mt-1 text-sm text-muted-foreground">{score.recommendation}</p>
        </CardContent>
      </Card>
      {sections.kind === "hidden" && <DetailsHiddenNotice />}
      {sections.kind === "shown" && (
        <>
          <ScoreBreakdownCard breakdown={sections.breakdown} withoutData={sections.withoutData} />
          <ScoreFactorList factors={sections.factors} />
        </>
      )}
    </div>
  );
}
