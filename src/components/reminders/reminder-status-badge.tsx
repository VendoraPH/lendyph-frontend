import { Badge } from "@/components/ui/badge";
import { deliveryStatusMeta, queueStatusMeta, type StatusMeta } from "@/lib/reminders";
import { cn } from "@/lib/utils";
import type { DeliveryStatus, ReminderQueueStatus } from "@/types/reminder";

function StatusBadge({ meta }: { meta: StatusMeta | undefined }) {
  if (!meta) return <Badge variant="outline">Unknown</Badge>;
  return (
    <Badge variant="outline" title={meta.description} className={cn("border", meta.className)}>
      {meta.label}
    </Badge>
  );
}

/** `loggedOnly`: the send was only logged (test mode), so it reads "Logged". */
export function QueueStatusBadge({ status, loggedOnly = false }: { status: ReminderQueueStatus; loggedOnly?: boolean }) {
  return <StatusBadge meta={queueStatusMeta(status, loggedOnly)} />;
}

export function DeliveryStatusBadge({ status, loggedOnly = false }: { status: DeliveryStatus; loggedOnly?: boolean }) {
  return <StatusBadge meta={deliveryStatusMeta(status, loggedOnly)} />;
}

/** On each message that was only logged: nothing reached the member. */
export function TestModeBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      title="Logged only, not sent. Nothing reached the member."
      className={cn(
        "border border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-500/10 dark:text-sky-300",
        className,
      )}
    >
      Test mode
    </Badge>
  );
}
