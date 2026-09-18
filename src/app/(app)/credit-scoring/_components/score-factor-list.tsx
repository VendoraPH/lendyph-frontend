import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ScoreFactor } from "@/types/credit-scoring";

export function ScoreFactorList({ factors }: { factors: ScoreFactor[] }) {
  const positives = factors.filter((f) => f.impact === "positive");
  const risks = factors.filter((f) => f.impact === "risk");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-emerald-600 dark:text-emerald-400">
            Positive Factors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {positives.length === 0 && (
            <p className="text-sm text-muted-foreground">No positive factors recorded.</p>
          )}
          {positives.map((f) => (
            <div key={f.id} className="text-sm">
              <span className="font-medium">{f.label}</span>
              <Badge variant="secondary" className="ml-2">{f.category}</Badge>
              <p className="text-muted-foreground">{f.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-red-600 dark:text-red-400">
            Risk Factors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {risks.length === 0 && (
            <p className="text-sm text-muted-foreground">No risk factors recorded.</p>
          )}
          {risks.map((f) => (
            <div key={f.id} className="text-sm">
              <span className="font-medium">{f.label}</span>
              <Badge variant="secondary" className="ml-2">{f.category}</Badge>
              <p className="text-muted-foreground">{f.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
