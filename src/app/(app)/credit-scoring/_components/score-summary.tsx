import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { SCORE_CONTEXT_LABELS, labelOf } from "@/lib/credit-scoring/labels";
import {
  advisoryLine,
  otherBranchLoansNote,
  scoreView,
  showsLimitedHistory,
} from "@/lib/credit-scoring/score-state";
import { RiskLevelBadge } from "./risk-level-badge";
import { ConfidenceBadge } from "./confidence-badge";
import type { CreditScore } from "@/types/credit-scoring";

/**
 * A score's headline in every state: the figure and band when scored, words
 * otherwise (never a 0), with the advisory line, the confidence badges and the
 * server's note on loans the caller can't see.
 */
export function ScoreSummary({ score }: { score: CreditScore }) {
  const view = scoreView(score);
  const advisory = advisoryLine(score);
  const otherBranches = otherBranchLoansNote(score.data_used);

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        {view.kind === "scored" ? (
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-3xl font-semibold tabular-nums">{view.score}</p>
              <p className="text-xs text-muted-foreground">out of 100</p>
            </div>
            <RiskLevelBadge level={view.riskLevel} />
            {showsLimitedHistory(score) && <Badge variant="outline">Limited History</Badge>}
            {score.confidence && <ConfidenceBadge level={score.confidence} />}
          </div>
        ) : (
          <p className="text-lg font-medium">{view.message}</p>
        )}

        {view.kind === "scored" && score.confidence_reason && (
          <p className="text-sm text-muted-foreground">{score.confidence_reason}</p>
        )}

        {score.calculated_at && (
          <p className="text-xs text-muted-foreground">
            {score.context ? `${labelOf(SCORE_CONTEXT_LABELS, score.context)} · ` : ""}
            {formatDateTime(score.calculated_at)}
          </p>
        )}

        {advisory && <p className="text-xs text-muted-foreground">{advisory}</p>}

        {otherBranches && (
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{otherBranches}</p>
        )}
      </CardContent>
    </Card>
  );
}
