import { ToneBadge } from "@/components/loan-origination/badges";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { ApplicantMessage } from "@/types/loan-origination";

/**
 * Messages meant for the applicant, newest first. Nothing can reach an
 * applicant until the owner signs, so each reads as the server records it:
 * "Logged, not sent". The applicant sees them when they track the application.
 */
export function MessagesPanel({ messages }: { messages: ApplicantMessage[] }) {
  if (messages.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No messages for the applicant yet.</p>;
  }
  return (
    <Card>
      <CardContent className="pt-4">
        <ul className="space-y-3">
          {messages.map((m) => (
            <li key={m.id} className="space-y-1 border-l-2 border-brand-orange/40 pl-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{m.kind_label}</span>
                <ToneBadge tone={m.delivered ? "success" : "warning"}>{m.delivery_label}</ToneBadge>
                <span className="text-xs text-muted-foreground">{m.channel_label}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{m.body}</p>
              <p className="text-xs text-muted-foreground">
                {m.author_name ?? "System"}
                {m.created_at && <> · {formatDateTime(m.created_at)}</>}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
