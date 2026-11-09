import { CheckCircle2, CircleDashed, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ReconciliationMatch } from "@/types";
import { matchLabel } from "../_lib/reconciliation-view";

const MATCH_STYLE: Record<ReconciliationMatch, { icon: typeof CheckCircle2; className: string }> = {
  matched: {
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  },
  possible: {
    icon: HelpCircle,
    className: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  },
  unmatched: {
    icon: CircleDashed,
    className: "bg-slate-500/10 text-slate-700 border-slate-500/30",
  },
};

export function MatchBadge({ match }: { match: ReconciliationMatch }) {
  const { icon: Icon, className } = MATCH_STYLE[match];
  return (
    <Badge variant="outline" className={className}>
      <Icon className="mr-1 h-3 w-3" />
      {matchLabel(match)}
    </Badge>
  );
}

export function ReconciledBadge({ reconciled, label }: { reconciled: boolean; label: string }) {
  return (
    <Badge
      variant="outline"
      className={
        reconciled
          ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
          : "bg-amber-500/10 text-amber-700 border-amber-500/30"
      }
    >
      {label}
    </Badge>
  );
}
