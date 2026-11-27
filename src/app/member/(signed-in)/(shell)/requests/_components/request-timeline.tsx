import { formatDateTime } from "@/lib/format";
import { REQUEST_ACTOR, REQUEST_STATUS, labelOf } from "@/lib/portal/labels";
import type { RequestDetail } from "@/lib/portal/types";

/** Each step the request took, oldest first. Staff are "Branch staff", never named (portal design §6). */
export function RequestTimeline({ events }: { events: RequestDetail["timeline"] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">Nothing has happened yet.</p>;
  return (
    <ol className="relative space-y-4 border-l pl-4">
      {events.map((event, index) => (
        <li key={`${event.created_at}-${index}`} className="relative">
          <span className="absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full bg-primary" aria-hidden />
          <p className="text-sm font-medium">{labelOf(REQUEST_STATUS, event.to_status)}</p>
          <p className="text-xs text-muted-foreground">
            {labelOf(REQUEST_ACTOR, event.actor)} · {formatDateTime(event.created_at)}
          </p>
          {event.message && <p className="mt-1 rounded-md bg-muted/50 p-2 text-sm whitespace-pre-line break-words">{event.message}</p>}
        </li>
      ))}
    </ol>
  );
}
