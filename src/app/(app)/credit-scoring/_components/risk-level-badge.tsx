import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { riskLevelColor, riskLevelLabel } from "@/lib/credit-scoring/risk-level";
import type { RiskLevel } from "@/types/credit-scoring";

export function RiskLevelBadge({ level }: { level: RiskLevel }) {
  return (
    <Badge variant="outline" className={cn("border", riskLevelColor(level))}>
      {riskLevelLabel(level)}
    </Badge>
  );
}
