import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { labelOf, statusMeta } from "../_lib/labels";
import { REVIEW_HISTORY_LABELS } from "../_lib/review-chain";
import type { CdaHistoryEvent } from "@/types/cda";

/** The report's history, newest first, as the server recorded it (carried over from #510 by Augustin). */
export function WorkflowHistory({ events }: { events: CdaHistoryEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">History</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <ol className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="text-sm">
                <p>
                  <span className="font-medium">{e.user_name}</span> · {labelOf(REVIEW_HISTORY_LABELS, e.action)}
                </p>
                {e.from_status && e.to_status && e.from_status !== e.to_status && (
                  <p className="text-xs text-muted-foreground">
                    {statusMeta(e.from_status).label} → {statusMeta(e.to_status).label}
                  </p>
                )}
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
