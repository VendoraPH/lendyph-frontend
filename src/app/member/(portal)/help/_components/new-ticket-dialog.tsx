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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/notify";
import { TICKET_CATEGORIES, ticketProblem } from "@/lib/portal/engagement";
import { attachmentProblem } from "@/lib/portal/requests";
import { portalService } from "@/services/portal.service";
import type { TicketCategory } from "@/types/portal";
import { AttachmentsInput } from "../../../_components/attachments-input";

export function NewTicketDialog({
  open,
  onOpenChange,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}) {
  const [category, setCategory] = useState<TicketCategory>("other");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  if (useDialogOpening(open, null)) {
    setCategory("other");
    setSubject("");
    setMessage("");
    setFiles([]);
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = ticketProblem({ subject, message }) ?? attachmentProblem(files);
    if (problem) return notifyWarning(problem);
    setBusy(true);
    portalService
      .submitTicket({ category, subject: subject.trim(), message: message.trim(), attachments: files })
      .then((ticket) => {
        notifySuccess(ticket?.reference ? `Sent as ${ticket.reference}` : "Your question was sent");
        onOpenChange(false);
        onSubmitted();
      })
      .catch((err) => notifyError(err, "Your question could not be sent."))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask the cooperative</DialogTitle>
          <DialogDescription>Staff usually answer within one working day. You will be notified.</DialogDescription>
        </DialogHeader>
        <form id="new-ticket" className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-category">Topic</Label>
            <NativeSelect
              id="ticket-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
            >
              {(Object.keys(TICKET_CATEGORIES) as TicketCategory[]).map((c) => (
                <NativeSelectOption key={c} value={c}>
                  {TICKET_CATEGORIES[c]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input id="ticket-subject" maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-message">Message</Label>
            <Textarea id="ticket-message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <AttachmentsInput id="ticket-files" files={files} onChange={setFiles} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="new-ticket" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
