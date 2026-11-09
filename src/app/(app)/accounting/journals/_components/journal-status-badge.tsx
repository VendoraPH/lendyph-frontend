import { Badge } from "@/components/ui/badge";
import type { JournalStatus } from "@/types";
import { journalStatusLabel } from "../../_lib/display-labels";

const STATUS_STYLES: Record<JournalStatus, string> = {
  draft: "bg-slate-500/10 text-slate-700 border-slate-500/30",
  posted: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  reversed: "bg-orange-500/10 text-orange-700 border-orange-500/30",
};

export function JournalStatusBadge({ status }: { status: JournalStatus }) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status]}>
      {journalStatusLabel(status)}
    </Badge>
  );
}
