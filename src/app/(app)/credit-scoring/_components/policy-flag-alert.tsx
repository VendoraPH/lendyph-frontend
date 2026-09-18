import { AlertTriangle, Flag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PolicyFlag } from "@/types/credit-scoring";
import { formatDateTime } from "@/lib/format";

export function PolicyFlagAlert({ flags }: { flags: PolicyFlag[] }) {
  if (flags.length === 0) return null;

  return (
    <div className="space-y-2">
      {flags.map((flag) => (
        <Card
          key={flag.id}
          className={
            flag.type === "hard_flag"
              ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-500/10"
              : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-500/10"
          }
        >
          <CardContent className="flex items-start gap-3 py-3">
            {flag.type === "hard_flag" ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            ) : (
              <Flag className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{flag.label}</span>
                <Badge variant={flag.type === "hard_flag" ? "destructive" : "outline"}>
                  {flag.type === "hard_flag" ? "Hard Flag" : "Soft Flag"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{flag.detail}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(flag.triggered_at)}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
