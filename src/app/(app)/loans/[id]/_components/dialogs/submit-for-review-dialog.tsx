"use client";

import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SubmitForReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}

export function SubmitForReviewDialog({
  open,
  onOpenChange,
  onSubmit,
}: SubmitForReviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit for Review</DialogTitle>
          <DialogDescription>
            Are you sure you want to submit this loan application for review?
            Once submitted, it will be queued for approval.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            onClick={onSubmit}
          >
            <Send className="mr-2 h-4 w-4" />
            Submit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
