"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { TICKET_STATUS } from "@/lib/portal/engagement";
import { cn } from "@/lib/utils";
import { portalAdminService } from "@/services/portal-admin.service";
import type { PortalAttachment, StaffSupportTicket, TicketStatus } from "@/types/portal";

/** Statuses staff can move a ticket to; "Submitted" is only ever the member's. */
const STAFF_STATUSES = (Object.keys(TICKET_STATUS) as TicketStatus[]).filter((s) => s !== "submitted");

/** The ticket's thread, a reply to the member and the status it moves to. */
export function TicketReplyDialog({
  ticket,
  onOpenChange,
  onDone,
}: {
  ticket: StaffSupportTicket | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const open = ticket !== null;
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<TicketStatus>("in_progress");
  const [busy, setBusy] = useState(false);

  if (useDialogOpening(open, ticket)) {
    setMessage("");
    setStatus(ticket && ticket.status !== "submitted" ? ticket.status : "in_progress");
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    // Closing without a word is allowed; any other change needs a reply.
    if (!message.trim() && status !== "closed") return notifyValidation(["Reply to the member"]);
    setBusy(true);
    portalAdminService
      .replyToTicket(ticket.id, { message: message.trim(), status })
      .then(() => {
        notifySuccess(`${ticket.reference} updated`);
        onOpenChange(false);
        onDone();
      })
      .catch((err) => notifyError(err, "The reply could not be sent."))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ticket?.subject}</DialogTitle>
          <DialogDescription>
            {ticket?.reference} · {ticket?.member_name}. The member is notified and sees your reply in the portal.
          </DialogDescription>
        </DialogHeader>
        {ticket && (
          <ol className="space-y-2">
            <Entry
              author={ticket.member_name}
              at={ticket.created_at}
              message={ticket.message}
              attachments={ticket.attachments}
              member
            />
            {ticket.replies.map((r) => (
              <Entry
                key={r.id}
                author={r.author === "member" ? ticket.member_name : r.author_name || "Staff"}
                at={r.created_at}
                message={r.message}
                attachments={r.attachments}
                member={r.author === "member"}
              />
            ))}
          </ol>
        )}
        <form id="ticket-reply" className="space-y-4" onSubmit={save}>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-reply-message">Reply to the member</Label>
            <Textarea id="ticket-reply-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-reply-status">Status after this reply</Label>
            <NativeSelect
              id="ticket-reply-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TicketStatus)}
            >
              {STAFF_STATUSES.map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {TICKET_STATUS[s].label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="ticket-reply" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Entry({
  author,
  at,
  message,
  attachments,
  member,
}: {
  author: string;
  at: string;
  message: string;
  attachments: PortalAttachment[];
  member: boolean;
}) {
  return (
    <li className={cn("rounded-md border p-3 text-sm", member ? "bg-muted/30" : "border-primary/30")}>
      <p className="mb-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{author}</span> · {formatDateTime(at)}
      </p>
      {message && <p className="whitespace-pre-line break-words">{message}</p>}
      {attachments?.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <li key={a.id}>
              <a href={a.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                {a.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
