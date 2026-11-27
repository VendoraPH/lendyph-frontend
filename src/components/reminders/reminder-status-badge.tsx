import { Badge } from "@/components/ui/badge";
import { deliveryStatusMeta, queueStatusMeta, type SendMode, type StatusMeta } from "@/lib/reminders";
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

/**
 * `mode` is the row's own (see `rowTestMode`): a send reads "Logged" in test
 * mode, "Sent" only when known live, and a neutral "Processed" when unknown.
 */
export function QueueStatusBadge({ status, mode }: { status: ReminderQueueStatus; mode: SendMode }) {
  return <StatusBadge meta={queueStatusMeta(status, mode)} />;
}

export function DeliveryStatusBadge({ status, mode }: { status: DeliveryStatus; mode: SendMode }) {
  return <StatusBadge meta={deliveryStatusMeta(status, mode)} />;
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
