"use client";

import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StatementOfAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationNumber: string;
  loading: boolean;
  data: Record<string, unknown> | null;
}

export function StatementOfAccountDialog({
  open,
  onOpenChange,
  applicationNumber,
  loading,
  data,
}: StatementOfAccountDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Statement of Account</DialogTitle>
          <DialogDescription>
            Full transaction history and balance for{" "}
            <span className="font-medium">{applicationNumber}</span>.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="space-y-3 pt-2">
            <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted/50 p-3 text-[11px] leading-relaxed font-mono">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No data available
          </p>
        )}
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
