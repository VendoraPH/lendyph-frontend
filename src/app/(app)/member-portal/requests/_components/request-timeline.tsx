import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { PortalRequestEvent } from "@/types/portal-admin";
import { ACTOR_LABELS, REQUEST_STATUS_LABELS, labelOf } from "../../_lib/labels";

/** Every move the request made, oldest first, with staff names. Every message here is shown to the member too. */
export function RequestTimeline({ events }: { events: PortalRequestEvent[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Timeline</CardTitle>
        <p className="text-xs text-muted-foreground">The member sees every message here.</p>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        ) : (
          <ol className="space-y-3">
            {events.map((e, i) => (
              <li key={`${e.created_at}-${i}`} className="border-l-2 pl-3 text-sm">
                <p className="font-medium">{labelOf(REQUEST_STATUS_LABELS, e.to_status)}</p>
                <p className="text-xs text-muted-foreground">
                  {e.user?.name ?? labelOf(ACTOR_LABELS, e.actor)}
                  {e.created_at ? ` · ${formatDateTime(e.created_at)}` : ""}
                </p>
                {e.message && <p className="mt-1 whitespace-pre-wrap">{e.message}</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
