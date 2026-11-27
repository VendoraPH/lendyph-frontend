import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { categoryDataNote } from "@/lib/credit-scoring/score-state";
import type { FactorWithoutData, ScoreCategoryBreakdown } from "@/types/credit-scoring";

/**
 * Each category's own factor points as the server sent them, unscaled. The
 * bar only draws those two numbers; the score itself is the server's.
 */
export function ScoreBreakdownCard({
  breakdown,
  withoutData = [],
}: {
  breakdown: ScoreCategoryBreakdown[];
  withoutData?: FactorWithoutData[];
}) {
  if (breakdown.length === 0 && withoutData.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Score Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {breakdown.map((row) => {
          const note = categoryDataNote(row);
          return (
            <div key={row.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{row.category}</span>
                <span className="text-muted-foreground">
                  {`${note ?? `${row.points_earned}/${row.points_possible} pts`} · ${row.weight_percent}% weight`}
                </span>
              </div>
              {note === null && (
                <Progress
                  value={row.points_possible > 0 ? (row.points_earned / row.points_possible) * 100 : 0}
                  aria-label={`${row.category}: ${row.points_earned} of ${row.points_possible} points`}
                />
              )}
            </div>
          );
        })}

        {withoutData.length > 0 && (
          <div className="space-y-1 border-t pt-4">
            <p className="text-sm font-medium">No data yet</p>
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              {withoutData.map((f) => (
                <li key={`${f.category}-${f.label}`}>
                  {f.label} <span className="text-xs">· {f.category}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
