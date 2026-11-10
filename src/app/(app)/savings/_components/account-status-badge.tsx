import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SavingsAccountStatus } from "@/types";
import { ACCOUNT_STATUS_LABELS, labelOf } from "../_lib/savings-rules";

const TONE: Record<SavingsAccountStatus, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  dormant: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  frozen: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  closed: "bg-muted text-muted-foreground",
};

export function AccountStatusBadge({ status }: { status: SavingsAccountStatus }) {
  return (
    <Badge variant="secondary" className={cn("border-0", TONE[status] ?? TONE.closed)}>
      {labelOf(ACCOUNT_STATUS_LABELS, status)}
    </Badge>
  );
}
