import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TimeDepositStatus } from "@/types";
import { TD_STATUS_LABELS } from "../../_lib/time-deposit-rules";

const TONE: Record<TimeDepositStatus, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  matured: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  withdrawn: "bg-muted text-muted-foreground",
  rolled_over: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  preterminated: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

export function TdStatusBadge({ status }: { status: TimeDepositStatus }) {
  return (
    <Badge variant="secondary" className={cn("border-0", TONE[status])}>
      {TD_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
