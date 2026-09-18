import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ScoreCategoryBreakdown } from "@/types/credit-scoring";

export function ScoreBreakdownCard({ breakdown }: { breakdown: ScoreCategoryBreakdown[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Score Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {breakdown.map((row) => {
          const pct = row.points_possible > 0 ? (row.points_earned / row.points_possible) * 100 : 0;
          return (
            <div key={row.category} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{row.category}</span>
                <span className="text-muted-foreground">
                  {row.points_earned}/{row.points_possible} pts · {row.weight_percent}% weight
                </span>
              </div>
              <Progress value={pct} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
