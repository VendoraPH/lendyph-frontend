"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationNumber: string;
  borrowerName: string;
  remarks: string;
  onRemarksChange: (value: string) => void;
  onApprove: () => void;
}

export function ApproveDialog({
  open,
  onOpenChange,
  applicationNumber,
  borrowerName,
  remarks,
  onRemarksChange,
  onApprove,
}: ApproveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve Loan Application</DialogTitle>
          <DialogDescription>
            You are about to approve{" "}
            <span className="font-medium">{applicationNumber}</span> for{" "}
            <span className="font-medium">{borrowerName}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <Label htmlFor="approval-remarks">Remarks (optional)</Label>
            <Textarea
              id="approval-remarks"
              placeholder="Add any notes about this approval..."
              value={remarks}
              onChange={(e) => onRemarksChange(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-green-600 text-white hover:bg-green-700"
            onClick={onApprove}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Approve
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
