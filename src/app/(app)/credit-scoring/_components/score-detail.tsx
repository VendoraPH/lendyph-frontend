import { Card, CardContent } from "@/components/ui/card";
import { ScoreSummary } from "./score-summary";
import { ScoreBreakdownCard } from "./score-breakdown-card";
import { ScoreFactorList } from "./score-factor-list";
import type { CreditScore } from "@/types/credit-scoring";

/** A score with its recommendation, breakdown and factors, in every state. */
export function ScoreDetail({ score }: { score: CreditScore }) {
  return (
    <div className="space-y-6">
      <ScoreSummary score={score} />
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium">System Recommendation</p>
          <p className="mt-1 text-sm text-muted-foreground">{score.recommendation}</p>
        </CardContent>
      </Card>
      {score.status !== "not_scored" && (
        <>
          <ScoreBreakdownCard breakdown={score.category_breakdown} withoutData={score.factors_without_data} />
          <ScoreFactorList factors={score.factors} />
        </>
      )}
    </div>
  );
}
