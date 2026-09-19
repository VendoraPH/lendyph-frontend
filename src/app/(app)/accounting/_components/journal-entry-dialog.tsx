"use client";

import { useState } from "react";
import { PermissionGate } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCentavos } from "@/lib/accounting/money";
import { formatDate } from "@/lib/format";
import type { JournalEntry } from "@/types";
import { JournalSourceDocumentNote } from "./journal-source-document";

interface JournalEntryDialogProps {
  entry: JournalEntry | null;
  onOpenChange: (open: boolean) => void;
  onPost: (entry: JournalEntry) => void;
  onReverse: (entry: JournalEntry, reason: string) => void;
}

/**
 * One entry, its lines, and the two things that can be done to it.
 *
 * There is no edit. A posted entry is immutable — the only lawful correction
 * is a reversal, which writes a second, mirrored entry and leaves the original
 * exactly where it is. That is not a limitation to work around; it is what
 * makes the audit trail worth having.
 */
export function JournalEntryDialog({
  entry,
  onOpenChange,
  onPost,
  onReverse,
}: JournalEntryDialogProps) {
  const [reason, setReason] = useState("");
  const [reversing, setReversing] = useState(false);

  if (!entry) return null;

  const close = (open: boolean) => {
    if (!open) {
      setReason("");
      setReversing(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {entry.reference || `Entry #${entry.id}`}
            <Badge variant="outline">{entry.status}</Badge>
          </DialogTitle>
          <DialogDescription>
            {formatDate(entry.date)} · {entry.description}
            {/* The source document, when there is one. This dialog is handed
                the entry the register already fetched — it never re-reads it —
                so it shows exactly what the list response carried. */}
            <JournalSourceDocumentNote entry={entry} />
          </DialogDescription>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Code</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="w-32 text-right">Debit</TableHead>
              <TableHead className="w-32 text-right">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entry.lines.map((line, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">{line.account_code}</TableCell>
                <TableCell className="text-sm">{line.account_name}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {line.debit ? formatCentavos(line.debit) : ""}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {line.credit ? formatCentavos(line.credit) : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-semibold">
                Total
              </TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {formatCentavos(entry.total_debit)}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {formatCentavos(entry.total_credit)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>

        {reversing ? (
          <div className="space-y-3 rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="reason">Why is this being reversed?</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Duplicate entry, wrong account, …"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This writes a second entry that mirrors this one. The original
              stays in the books and stays visible.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setReversing(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!reason.trim()}
                onClick={() => onReverse(entry, reason.trim())}
              >
                Reverse entry
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            {entry.status === "draft" && (
              <PermissionGate permission="journals:post">
                <Button onClick={() => onPost(entry)}>Post entry</Button>
              </PermissionGate>
            )}
            {entry.status === "posted" && (
              <PermissionGate permission="journals:reverse">
                <Button variant="outline" onClick={() => setReversing(true)}>
                  Reverse
                </Button>
              </PermissionGate>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
