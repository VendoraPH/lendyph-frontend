import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { confidenceColor, confidenceLabel } from "@/lib/credit-scoring/confidence";
import type { ScoreConfidence } from "@/types/credit-scoring";

export function ConfidenceBadge({ level }: { level: ScoreConfidence }) {
  return (
    <Badge variant="outline" className={cn("border", confidenceColor(level))}>
      {confidenceLabel(level)}
    </Badge>
  );
}
