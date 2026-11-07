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
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { notifyError, notifySuccess, notifyValidation, notifyWarning } from "@/lib/notify";
import { attachmentProblem } from "@/lib/portal/requests";
import { portalService } from "@/services/portal.service";
import type { PortalRequest } from "@/types/portal";
import { AttachmentsInput } from "../../../_components/attachments-input";

/** Answer the cooperative when it asks for more information. */
export function ReplyDialog({
  request,
  onOpenChange,
  onSent,
}: {
  request: PortalRequest | null;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}) {
  const open = request !== null;
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  if (useDialogOpening(open, request)) {
    setMessage("");
    setFiles([]);
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;
    if (!message.trim() && files.length === 0) return notifyValidation(["A message or a document"]);
    const problem = attachmentProblem(files);
    if (problem) return notifyWarning(problem);
    setBusy(true);
    portalService
      .replyToRequest(request.id, message.trim(), files)
      .then(() => {
        notifySuccess("Reply sent");
        onOpenChange(false);
        onSent();
      })
      .catch((err) => notifyError(err, "Your reply could not be sent."))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reply to {request?.reference}</DialogTitle>
          <DialogDescription>{request?.response ?? "Send the information the cooperative asked for."}</DialogDescription>
        </DialogHeader>
        <form id="request-reply" className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="reply-message">Message</Label>
            <Textarea id="reply-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <AttachmentsInput id="reply-files" files={files} onChange={setFiles} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="request-reply" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send reply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
