"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

interface Props {
  open: boolean;
  title: string;
  description: string;
  submitLabel: string;
  submitting: boolean;
  /** The form's own problem, in words, before the server decides. */
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}

/** The frame every CDD form shares: title, fields, the form's error, Cancel and the action. */
export function CddFormDialog({ open, title, description, submitLabel, submitting, error, onClose, onSubmit, children }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onClose()}>
      <DialogContent size="lg">
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">{children}</div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Spinner className="mr-2 h-4 w-4" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
