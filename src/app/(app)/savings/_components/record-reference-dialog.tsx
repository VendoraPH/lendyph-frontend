"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDialogOpening } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { getErrorMessage, httpStatusOf } from "@/lib/api-error";
import { notifyError, notifySuccess } from "@/lib/notify";
import { savingsService, timeDepositService } from "@/services";
import { FormField } from "./field";
import { RECORD_REFERENCE_MAX, recordReferenceProblem, type PayoutSource } from "../_lib/payout-reference";
import { serverFieldError } from "../_lib/step-errors";

/** The payout whose reference is recorded: a transaction (SVT-) or a time deposit (TD-). */
export interface RecordReferenceTarget {
  source: PayoutSource;
  id: number;
  /** Its SVT- or TD- number. */
  number: string;
  /** What it is, in words: "GCash withdrawal of ₱500.00 on Nov 10, 2026". */
  description: string;
}

interface RecordReferenceDialogProps {
  target: RecordReferenceTarget | null;
  onOpenChange: (open: boolean) => void;
  onRecorded: () => void;
}

/**
 * Record a payout's reference after the transfer (finish run round 6): once
 * only, moving no money. The server's refusal (a reference already used, or
 * one recorded a moment ago) shows under the field.
 */
export function RecordReferenceDialog({ target, onOpenChange, onRecorded }: RecordReferenceDialogProps) {
  const open = target !== null;
  const [reference, setReference] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, target ? `${target.source}-${target.id}` : null)) {
    setReference("");
    setSubmitted(false);
    setServerError(null);
  }

  const problem = target ? recordReferenceProblem(reference, target.source) : null;

  function submit() {
    setSubmitted(true);
    if (!target || problem) return;
    const typed = reference.trim();
    const send = (): Promise<unknown> =>
      target.source === "transaction"
        ? savingsService.recordReference(target.id, typed)
        : timeDepositService.recordPayoutReference(target.id, typed);
    run(send)
      ?.then(() => {
        notifySuccess("Reference recorded", `${target.number}: ${typed}`);
        onOpenChange(false);
        onRecorded();
      })
      .catch((err: unknown) => {
        // A refused reference (422) or one recorded a moment ago (409) reads under the field.
        const onField = serverFieldError(err, "reference") ?? (httpStatusOf(err) === 409 ? getErrorMessage(err) : null);
        setServerError(onField);
        if (!onField) notifyError(err, "Couldn't record the reference.");
      });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record reference for {target?.number}</DialogTitle>
          <DialogDescription>
            {target
              ? `${target.description}. Enter the bank, GCash or Maya reference of the money sent. It can be recorded once, and moves no money.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FormField id="rec-ref" label="Reference" error={serverError ?? (submitted ? problem : null)}>
            <Input
              id="rec-ref"
              aria-required
              autoComplete="off"
              maxLength={target ? RECORD_REFERENCE_MAX[target.source] : undefined}
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                setServerError(null);
              }}
            />
          </FormField>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Record reference"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
