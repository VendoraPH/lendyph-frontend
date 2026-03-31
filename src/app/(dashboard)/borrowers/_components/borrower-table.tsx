"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Borrower } from "@/types";
import { statusBadgeColor, formatCurrency, getInitials } from "./utils";
import { BorrowerActionsCell } from "./borrower-actions";

interface BorrowerTableProps {
  borrowers: Borrower[];
  onEdit: (updated: Borrower) => void;
  onToggleStatus: (id: number) => void;
  onDelete: (id: number) => void;
  onRowClick: (borrower: Borrower) => void;
}

export function BorrowerTable({
  borrowers,
  onEdit,
  onToggleStatus,
  onDelete,
  onRowClick,
}: BorrowerTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Borrower</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className="text-right">Loans</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {borrowers.map((borrower) => (
            <TableRow
              key={borrower.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onRowClick(borrower)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar size="sm">
                    {borrower.photo ? (
                      <AvatarImage
                        src={borrower.photo}
                        alt={borrower.full_name}
                      />
                    ) : null}
                    <AvatarFallback className="bg-brand-orange/10 text-brand-orange text-xs font-semibold">
                      {getInitials(borrower.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{borrower.full_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {borrower.borrower_code}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {borrower.phone}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {[borrower.city, borrower.province]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {borrower.total_loans}
              </TableCell>
              <TableCell className="text-right tabular-nums text-brand-orange font-medium">
                {borrower.total_outstanding
                  ? formatCurrency(borrower.total_outstanding)
                  : "—"}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={statusBadgeColor[borrower.status]}
                >
                  {borrower.status}
                </Badge>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <BorrowerActionsCell
                  borrower={borrower}
                  onEdit={onEdit}
                  onToggleStatus={() => onToggleStatus(borrower.id)}
                  onDelete={() => onDelete(borrower.id)}
                />
              </TableCell>
            </TableRow>
          ))}
          {borrowers.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="h-24 text-center text-muted-foreground"
              >
                No borrowers found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
