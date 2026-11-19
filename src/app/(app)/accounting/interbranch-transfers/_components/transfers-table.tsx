"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCentavos } from "@/lib/accounting/money";
import { formatDate } from "@/lib/format";
import type { InterbranchTransfer } from "@/types/interbranch-transfer";
import {
  canSendBack,
  transferActionButtons,
  transferStatusLabel,
  type TransferActionButton,
} from "../_lib/transfers";

interface TransfersTableProps {
  rows: InterbranchTransfer[];
  canCreate: boolean;
  onAction: (transfer: InterbranchTransfer, action: TransferActionButton) => void;
  onSendBack: (transfer: InterbranchTransfer) => void;
  /** The in-transit report shows age instead of the status. */
  showAge?: boolean;
}

const STATUS_TONE: Record<InterbranchTransfer["status"], string> = {
  pending_approval: "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  in_transit: "border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  received: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  rejected: "border-red-300 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
  cancelled: "text-muted-foreground",
  reversed: "text-muted-foreground",
};

function days(n: number | null): string {
  if (n === null) return "—";
  return n === 1 ? "1 day" : `${n} days`;
}

/** One row per transfer, with only the steps the server allows this user. */
export function TransfersTable({ rows, canCreate, onAction, onSendBack, showAge }: TransfersTableProps) {
  return (
    <Table>
      <TableHeader className="sticky top-0 z-10 bg-background">
        <TableRow>
          <TableHead>Transfer</TableHead>
          <TableHead>Requested</TableHead>
          <TableHead>From</TableHead>
          <TableHead>To</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>{showAge ? "In transit for" : "Status"}</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((t) => {
          const buttons = transferActionButtons(t.actions);
          const sendBack = canSendBack(t, canCreate);
          return (
            <TableRow key={t.id}>
              <TableCell>
                <p className="font-mono text-sm">{t.transfer_number}</p>
                <p className="max-w-56 truncate text-xs text-muted-foreground" title={t.purpose}>
                  {t.purpose}
                </p>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {t.created_at ? formatDate(t.created_at) : "—"}
                {t.created_by ? <p className="text-xs text-muted-foreground">{t.created_by.full_name}</p> : null}
              </TableCell>
              <TableCell className="text-sm">
                {t.source_branch?.name ?? "—"}
                <p className="text-xs text-muted-foreground">{t.from_account?.name ?? ""}</p>
              </TableCell>
              <TableCell className="text-sm">
                {t.destination_branch?.name ?? "—"}
                <p className="text-xs text-muted-foreground">{t.to_account?.name ?? ""}</p>
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">{formatCentavos(t.amount)}</TableCell>
              <TableCell>
                {showAge ? (
                  days(t.age_days)
                ) : (
                  <Badge variant="outline" className={STATUS_TONE[t.status]}>
                    {transferStatusLabel(t)}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-wrap justify-end gap-1.5">
                  {buttons.map((b) => (
                    <Button
                      key={b.kind}
                      size="sm"
                      variant={b.kind === "approve" || b.kind === "receive" ? "default" : "outline"}
                      onClick={() => onAction(t, b)}
                      aria-label={`${b.label} ${t.transfer_number}`}
                    >
                      {b.label}
                    </Button>
                  ))}
                  {sendBack ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSendBack(t)}
                      aria-label={`Send back ${t.transfer_number}`}
                    >
                      Send back
                    </Button>
                  ) : null}
                  {buttons.length === 0 && !sendBack ? <span className="text-xs text-muted-foreground">—</span> : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
