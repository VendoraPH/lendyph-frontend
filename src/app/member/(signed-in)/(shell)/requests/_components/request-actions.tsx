"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/portal/form-field";
import { SectionCard } from "@/components/portal/section-card";
import { useConfirmedSubmit } from "@/lib/portal/hooks/use-confirmed-submit";
import { portalService } from "@/lib/portal/portal-api";
import { CONFIRMS } from "@/lib/portal/server-confirm";
import type { RequestDetail } from "@/lib/portal/types";

/** Reply while the branch asks for more information; cancel while nobody has decided yet. */
export function RequestActions({ request, onChanged }: { request: RequestDetail; onChanged: () => void }) {
  const { submitting, submit, fieldErrors } = useConfirmedSubmit();
  const [message, setMessage] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>();

  const reply = (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim()) {
      setLocalError("Write your reply.");
      return;
    }
    setLocalError(undefined);
    submit(() => portalService.replyRequest(request.id, message.trim()), {
      expect: CONFIRMS.done,
      success: "Reply sent to your branch",
      failure: "We couldn't send your reply. Please try again.",
      onConfirmed: () => {
        setMessage("");
        onChanged();
      },
    });
  };

  const cancel = () =>
    submit(() => portalService.cancelRequest(request.id), {
      expect: CONFIRMS.done,
      success: "Request cancelled",
      failure: "We couldn't cancel this request. Please try again.",
      onConfirmed: () => {
        setConfirmCancel(false);
        onChanged();
      },
    });

  return (
    <SectionCard title="What you can do">
      <div className="space-y-4">
        {request.can_reply && (
          <form onSubmit={reply} className="space-y-3" noValidate>
            <FormField id="rq-reply" label="Reply to your branch" error={localError ?? fieldErrors.message}>
              <Textarea id="rq-reply" rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
            </FormField>
            <Button type="submit" disabled={submitting}>
              {submitting && <Spinner className="h-4 w-4" />}
              Send reply
            </Button>
          </form>
        )}
        {request.can_cancel && (
          <Button variant="outline" onClick={() => setConfirmCancel(true)} disabled={submitting}>
            Cancel this request
          </Button>
        )}
      </div>
      <Dialog open={confirmCancel} onOpenChange={(open) => !submitting && setConfirmCancel(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this request?</DialogTitle>
            <DialogDescription>
              {request.type === "savings_withdrawal"
                ? "The amount set aside for it becomes available again. You can send a new request later."
                : "Your branch won't act on it. You can send a new request later."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(false)} disabled={submitting}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={cancel} disabled={submitting}>
              {submitting && <Spinner className="h-4 w-4" />}
              Cancel request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
