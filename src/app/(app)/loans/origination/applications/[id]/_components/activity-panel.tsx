import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/loan-origination";
import type { ApplicationNote, StatusHistoryEntry } from "@/types/loan-origination";

/** Staff notes and the status history, newest first as the server sends them. */
export function ActivityPanel({ notes, history }: { notes: ApplicationNote[]; history: StatusHistoryEntry[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Internal notes</CardTitle>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="border-l-2 border-brand-orange/40 pl-3">
                  <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {n.author_name} · {formatDateTime(n.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Status history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No changes yet.</p>
          ) : (
            <ol className="space-y-3">
              {history.map((h) => (
                <li key={h.id} className="border-l-2 border-muted pl-3">
                  <p className="text-sm font-medium">
                    {h.from_status ? `${STATUS_LABELS[h.from_status]} → ` : ""}
                    {STATUS_LABELS[h.to_status]}
                  </p>
                  {h.note && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{h.note}</p>}
                  <p className="text-xs text-muted-foreground">
                    {h.changed_by_name ?? "Applicant or system"} · {formatDateTime(h.changed_at)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
