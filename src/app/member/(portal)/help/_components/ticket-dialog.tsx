"use client";

import { useCallback, useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess, notifyValidation, notifyWarning } from "@/lib/notify";
import { canReplyToTicket, TICKET_STATUS } from "@/lib/portal/engagement";
import { TONE_CLASS } from "@/lib/portal/labels";
import { attachmentProblem } from "@/lib/portal/requests";
import { cn } from "@/lib/utils";
import { portalService } from "@/services/portal.service";
import type { PortalAttachment, SupportTicket } from "@/types/portal";
import { AttachmentsInput } from "../../../_components/attachments-input";
import { StatusPill } from "../../../_components/portal-shell";

/** One ticket's conversation, with a reply box until it is closed. */
export function TicketDialog({
  ticketId,
  onClose,
  onChanged,
}: {
  ticketId: number | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const fetcher = useCallback(() => portalService.ticket(ticketId ?? 0), [ticketId]);
  const resource = useApiResource(fetcher, ticketId !== null);

  return (
    <Dialog open={ticketId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DataState
          resource={resource}
          endpoints={["GET /portal/support-tickets/{id}"]}
          summary="This ticket's conversation."
        >
          {(ticket) => (
            <Thread
              key={ticket.id}
              ticket={ticket}
              onReplied={() => {
                resource.refetch();
                onChanged();
              }}
            />
          )}
        </DataState>
      </DialogContent>
    </Dialog>
  );
}

function Thread({ ticket, onReplied }: { ticket: SupportTicket; onReplied: () => void }) {
  const status = TICKET_STATUS[ticket.status] ?? TICKET_STATUS.open;
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="pr-6">{ticket.subject}</DialogTitle>
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {ticket.reference} · {formatDateTime(ticket.created_at)}
          <StatusPill className={TONE_CLASS[status.tone]}>{status.label}</StatusPill>
        </p>
      </DialogHeader>
      <ol className="space-y-3">
        <Message author="You" mine message={ticket.message} at={ticket.created_at} attachments={ticket.attachments} />
        {ticket.replies.map((r) => (
          <Message
            key={r.id}
            author={r.author === "member" ? "You" : r.author_name || "Cooperative"}
            mine={r.author === "member"}
            message={r.message}
            at={r.created_at}
            attachments={r.attachments}
          />
        ))}
      </ol>
      {canReplyToTicket(ticket.status) ? (
        <ReplyBox ticketId={ticket.id} onReplied={onReplied} />
      ) : (
        <p className="text-sm text-muted-foreground">This ticket is closed. Ask a new question if you still need help.</p>
      )}
    </div>
  );
}

function Message({
  author,
  mine,
  message,
  at,
  attachments,
}: {
  author: string;
  mine: boolean;
  message: string;
  at: string;
  attachments: PortalAttachment[];
}) {
  return (
    <li className={cn("rounded-lg border p-3 text-sm", mine ? "bg-muted/40" : "border-brand-orange/40")}>
      <p className="mb-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{author}</span> · {formatDateTime(at)}
      </p>
      <p className="whitespace-pre-line">{message}</p>
      {attachments?.length > 0 && (
        <ul className="mt-2 space-y-1">
          {attachments.map((a) => (
            <li key={a.id}>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline">
                <Paperclip className="h-3 w-3" aria-hidden /> {a.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function ReplyBox({ ticketId, onReplied }: { ticketId: number; onReplied: () => void }) {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return notifyValidation(["Message"]);
    const problem = attachmentProblem(files);
    if (problem) return notifyWarning(problem);
    setBusy(true);
    portalService
      .replyToTicket(ticketId, message.trim(), files)
      .then(() => {
        notifySuccess("Reply sent");
        setMessage("");
        setFiles([]);
        onReplied();
      })
      .catch((err) => notifyError(err, "Your reply could not be sent."))
      .finally(() => setBusy(false));
  };

  return (
    <form className="space-y-3 border-t pt-3" onSubmit={send}>
      <div className="space-y-1.5">
        <Label htmlFor="ticket-reply">Reply</Label>
        <Textarea id="ticket-reply" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <AttachmentsInput id="ticket-reply-files" files={files} onChange={setFiles} />
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send reply
        </Button>
      </div>
    </form>
  );
}
