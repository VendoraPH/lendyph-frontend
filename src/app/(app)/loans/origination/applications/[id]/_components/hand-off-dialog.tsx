"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { usePermission } from "@/hooks";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { formatDate } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { loanOriginationService } from "@/services";
import type { ApplicationDetail } from "@/types/loan-origination";
import { canCreateAnyway, handOffPayload, handOffRefusal, type HandOffRefusal } from "../../../_lib/hand-off";

/**
 * "Submit for approval", the hand-off: the server links or creates the member,
 * creates the draft loan through the loan rules and submits it into the
 * approval chain, then the application follows its loan. It checks the
 * assessment again at the loan's start date; every refusal is shown in its
 * words, and a match with a member on record offers "Create anyway" to
 * holders of `borrowers:create`.
 */
export function HandOffDialog({
  application: a,
  open,
  onOpenChange,
  onDone,
}: {
  application: ApplicationDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { can } = usePermission();
  const [startDate, setStartDate] = useState("");
  const [refusal, setRefusal] = useState<HandOffRefusal | null>(null);
  const [busy, setBusy] = useState(false);
  if (useDialogOpening(open, a.id)) {
    setStartDate("");
    setRefusal(null);
  }
  const assessment = a.assessment;

  const submit = (forceNewMember: boolean) => {
    setBusy(true);
    setRefusal(null);
    loanOriginationService
      .submitForApproval(a.id, handOffPayload(a.version, { startDate, forceNewMember }))
      .then((result) => {
        notifySuccess(
          `Submitted for approval as loan ${result.loan.application_number}`,
          result.loan.policy_exception ? "It goes to the Policy Exception approval chain, with the assessment's explanation." : undefined,
        );
        onDone();
        onOpenChange(false);
      })
      .catch((err: unknown) => {
        const read = handOffRefusal(err);
        setRefusal(read);
        // Changed or already handed off meanwhile: show the application as it is now.
        if (read.stale) onDone();
      })
      .then(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Submit for approval</DialogTitle>
          <DialogDescription>
            Creates the loan from this application through the loan rules and sends it into the approval chain. From then on
            the application follows its loan.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto text-sm">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {a.linked_borrower_id === null
                ? "No member is linked, so a pending member registration is made from the application, with its verified ID."
                : "The loan is made for the linked member. Their record isn't changed."}
            </li>
            {assessment ? (
              <li>
                Assessment: {assessment.result_label}
                {assessment.start_date && <>, for a loan starting {formatDate(assessment.start_date)}</>}.
                {assessment.policy_exception && " The loan goes to the Policy Exception approval chain."}
              </li>
            ) : (
              <li>The application hasn&apos;t been assessed yet.</li>
            )}
          </ul>
          <div className="space-y-1.5">
            <Label htmlFor="hand-off-start">Loan start date (optional)</Label>
            <Input id="hand-off-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Today when left blank. The assessment is checked again at this date and the product&apos;s current rate; if
              the result or the instalment changes, run the assessment again with this start date.
            </p>
          </div>
          {refusal && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription className="space-y-1">
                {refusal.messages.map((m) => (
                  <p key={m}>{m}</p>
                ))}
                {refusal.loanId !== null && (
                  <Link href={`/loans/${refusal.loanId}`} className="font-medium">
                    Open loan
                  </Link>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          {refusal && canCreateAnyway(refusal, can, a.linked_borrower_id) && (
            <Button variant="outline" onClick={() => submit(true)} disabled={busy}>
              Create anyway
            </Button>
          )}
          <Button onClick={() => submit(false)} disabled={busy || (refusal !== null && refusal.loanId !== null)}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Submit for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
