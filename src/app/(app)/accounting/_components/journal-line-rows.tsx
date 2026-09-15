"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Account, JournalLineDraft } from "@/types";
import { AccountSelect } from "./account-select";

interface JournalLineRowsProps {
  lines: JournalLineDraft[];
  accounts: Account[];
  /** Row indexes that failed validation, for highlighting. */
  errorRows: Set<number>;
  onChange: (index: number, patch: Partial<JournalLineDraft>) => void;
  onRemove: (index: number) => void;
}

export function JournalLineRows({
  lines,
  accounts,
  errorRows,
  onChange,
  onRemove,
}: JournalLineRowsProps) {
  /**
   * Typing in one amount column clears the other.
   *
   * A line is a debit or a credit, never both, and letting someone fill in
   * both produces an entry that validates as balanced while meaning nothing.
   * Clearing as they type is gentler than rejecting it afterwards.
   */
  const setAmount = (index: number, side: "debit" | "credit", value: string) => {
    onChange(index, {
      [side]: value,
      [side === "debit" ? "credit" : "debit"]: "",
    } as Partial<JournalLineDraft>);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[320px]">Account</TableHead>
          <TableHead>Line description</TableHead>
          <TableHead className="w-36 text-right">Debit</TableHead>
          <TableHead className="w-36 text-right">Credit</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line, index) => (
          <TableRow
            key={index}
            className={cn(errorRows.has(index) && "bg-destructive/5")}
          >
            <TableCell>
              <AccountSelect
                accounts={accounts}
                value={line.account_id}
                onChange={(id) => onChange(index, { account_id: id })}
                className="w-full"
              />
            </TableCell>
            <TableCell>
              <Input
                value={line.description}
                onChange={(e) => onChange(index, { description: e.target.value })}
                placeholder="Optional"
              />
            </TableCell>
            <TableCell>
              <Input
                value={line.debit}
                onChange={(e) => setAmount(index, "debit", e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="text-right font-mono"
              />
            </TableCell>
            <TableCell>
              <Input
                value={line.credit}
                onChange={(e) => setAmount(index, "credit", e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className="text-right font-mono"
              />
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(index)}
                // Two lines is the minimum a double entry can have. Removing
                // below that would leave a form that can never be valid.
                disabled={lines.length <= 2}
                aria-label={`Remove line ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
