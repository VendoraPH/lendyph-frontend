import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InterestRunStatus } from "@/types";
import { INTEREST_RUN_STATUS_LABELS } from "../../_lib/savings-rules";

const TONE: Record<InterestRunStatus, string> = {
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  posted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-muted text-muted-foreground",
  reversed: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

export function RunStatusBadge({ status }: { status: InterestRunStatus }) {
  return (
    <Badge variant="secondary" className={cn("border-0", TONE[status])}>
      {INTEREST_RUN_STATUS_LABELS[status]}
    </Badge>
  );
}
