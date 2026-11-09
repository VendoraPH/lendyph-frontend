"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { notifySuccess } from "@/lib/notify";
import { accountingService } from "@/services";
import type { OpeningBalance } from "@/types";
import { FINALISE_CONFIRM, finaliseState, requestFailure } from "../_lib/opening-balances";

interface FinalisePanelProps {
  opening: OpeningBalance;
  dirty: boolean;
  onAnswer: (opening: OpeningBalance) => void;
  onConflict: () => void;
}

/** Finalise posts the draft once. The server decides whether it can, and says why not. */
export function FinalisePanel({ opening, dirty, onAnswer, onConflict }: FinalisePanelProps) {
  const [confirming, setConfirming] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = finaliseState(opening, dirty);

  const finalise = () => {
    setPosting(true);
    setError(null);
    accountingService
      .finaliseOpeningBalances(opening.edit_version)
      .then((answer) => {
        setConfirming(false);
        notifySuccess("Opening balances posted.");
        onAnswer(answer);
      })
      .catch((err: unknown) => {
        const failure = requestFailure(err, [], "Could not post the opening balances.");
        if (failure.kind === "conflict") {
          setConfirming(false);
          onConflict();
        } else {
          setError(failure.message);
        }
      })
      .then(() => setPosting(false));
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Finalise</p>
          <p className="text-sm text-muted-foreground">
            Posts the opening balances as one journal entry, once.
          </p>
        </div>
        <Button onClick={() => setConfirming(true)} disabled={!state.enabled}>
          Finalise
        </Button>
      </div>
      {state.hint && <p className="text-sm text-muted-foreground">{state.hint}</p>}
      {state.reasons.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {state.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      <Dialog open={confirming} onOpenChange={(open) => !posting && setConfirming(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalise the opening balances?</DialogTitle>
            <DialogDescription>{FINALISE_CONFIRM}</DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={posting}>
              Cancel
            </Button>
            <Button onClick={finalise} disabled={posting}>
              {posting ? "Posting…" : "Finalise and post"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
