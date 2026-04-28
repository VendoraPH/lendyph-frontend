"use client";

import { XCircle } from "lucide-react";
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

interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationNumber: string;
  borrowerName: string;
  remarks: string;
  onRemarksChange: (value: string) => void;
  onReject: () => void;
}

export function RejectDialog({
  open,
  onOpenChange,
  applicationNumber,
  borrowerName,
  remarks,
  onRemarksChange,
  onReject,
}: RejectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Loan Application</DialogTitle>
          <DialogDescription>
            You are about to reject{" "}
            <span className="font-medium">{applicationNumber}</span> for{" "}
            <span className="font-medium">{borrowerName}</span>. Please
            provide a reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <Label htmlFor="rejection-remarks">
              Reason for Rejection{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="rejection-remarks"
              placeholder="Explain why this application is being rejected..."
              value={remarks}
              onChange={(e) => onRemarksChange(e.target.value)}
              className="mt-1.5"
              required
            />
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onReject}
            disabled={!remarks.trim()}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reject
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
