import { TableCell } from "@/components/ui/table";
import { rowScoreView } from "@/lib/credit-scoring/score-state";
import { RiskLevelBadge } from "./risk-level-badge";
import type { ScoreStatus, RiskLevel } from "@/types/credit-scoring";

/**
 * The Score and Risk Level cells of a list row. An insufficient-data row reads
 * "Insufficient data" across both, never a 0 or a band.
 */
export function ScoreCells({
  row,
}: {
  row: { status: ScoreStatus; score: number | null; risk_level: RiskLevel | null };
}) {
  const view = rowScoreView(row);
  if (view.kind !== "scored") {
    return (
      <TableCell colSpan={2} className="text-muted-foreground">
        {view.message}
      </TableCell>
    );
  }
  return (
    <>
      <TableCell className="tabular-nums">{view.score}</TableCell>
      <TableCell>
        <RiskLevelBadge level={view.riskLevel} />
      </TableCell>
    </>
  );
}
