import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { STATUS_META } from "../_lib/labels";
import type { CdaWorkflowEvent } from "@/types/cda";

/** The report's audit trail, newest first, as the server recorded it. */
export function WorkflowHistory({ events }: { events: CdaWorkflowEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">History</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workflow steps yet.</p>
        ) : (
          <ol className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="text-sm">
                <p>
                  <span className="font-medium">{e.user_name}</span>{" "}
                  {e.from_status ? `${STATUS_META[e.from_status].label} → ` : ""}
                  {STATUS_META[e.to_status].label}
                </p>
                <p className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</p>
                {e.reason && <p className="mt-1 text-xs italic text-muted-foreground">“{e.reason}”</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
