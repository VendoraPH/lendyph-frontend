import { Badge } from "@/components/ui/badge";
import type { CicSeverity } from "@/types/cic";
import { SEVERITY_LABELS } from "../_lib/labels";

export function SeverityBadge({ severity }: { severity: CicSeverity }) {
  return <Badge variant={severity === "error" ? "destructive" : "secondary"}>{SEVERITY_LABELS[severity]}</Badge>;
}

/** A record's readiness from the server's counts: errors first, then warnings, else ready. */
export function ReadinessBadge({ errors, warnings }: { errors: number; warnings: number }) {
  if (errors > 0) return <Badge variant="destructive">{errors === 1 ? "1 error" : `${errors} errors`}</Badge>;
  if (warnings > 0) return <Badge variant="secondary">{warnings === 1 ? "1 warning" : `${warnings} warnings`}</Badge>;
  return <Badge variant="outline">Ready</Badge>;
}
