import { Badge } from "@/components/ui/badge";
import { DELIVERY_STATUS_META, QUEUE_STATUS_META, type StatusMeta } from "@/lib/reminders";
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

export function QueueStatusBadge({ status }: { status: ReminderQueueStatus }) {
  return <StatusBadge meta={QUEUE_STATUS_META[status]} />;
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  return <StatusBadge meta={DELIVERY_STATUS_META[status]} />;
}
