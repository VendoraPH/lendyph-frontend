"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { runJournalAction } from "../_lib/journal-refusal";

interface PostJournalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Posts the entry. A rejection keeps the dialog open with the server's message. */
  onConfirm: () => Promise<void>;
  /** A 409 or 422 refusal: the journal may have changed, so reload it. */
  onRefused: () => void;
}

/** Posting is the point of no return: after it, the entry can only be reversed. */
export function PostJournalDialog({
  open,
  onOpenChange,
  onConfirm,
  onRefused,
}: PostJournalDialogProps) {
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = (next: boolean) => {
    if (posting) return;
    if (!next) setError(null);
    onOpenChange(next);
  };

  const confirm = () => {
    setPosting(true);
    setError(null);
    runJournalAction(onConfirm, onRefused, "Could not post this entry.").then((message) => {
      setError(message);
      setPosting(false);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={change}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Post this entry?</AlertDialogTitle>
          <AlertDialogDescription>
            Posting puts it in the books and gives it a journal number. It can&apos;t be undone or
            edited afterwards, only reversed by a second entry.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={posting}>Cancel</AlertDialogCancel>
          <Button onClick={confirm} disabled={posting}>
            {posting ? "Posting…" : "Post entry"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
