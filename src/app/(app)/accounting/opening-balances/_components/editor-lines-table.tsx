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
import type { Account } from "@/types";
import { AccountSelect } from "../../_components/account-select";
import { OPENING_EQUITY_LABEL, type EditorLine } from "../_lib/opening-balances";

interface EditorLinesTableProps {
  lines: EditorLine[];
  accounts: Account[];
  /** The server's 3050 account, shown as its own highlighted row. */
  equityAccountId: number | null;
  errorRows: Set<number>;
  disabled: boolean;
  onChange: (index: number, patch: Partial<EditorLine>) => void;
  onRemove: (index: number) => void;
}

/** Account, Debit and Credit per line. No totals here: they come from the server. */
export function EditorLinesTable({
  lines,
  accounts,
  equityAccountId,
  errorRows,
  disabled,
  onChange,
  onRemove,
}: EditorLinesTableProps) {
  // A line is a debit or a credit: typing one side clears the other.
  const setAmount = (index: number, side: "debit" | "credit", value: string) =>
    onChange(
      index,
      side === "debit" ? { debit: value, credit: "" } : { credit: value, debit: "" },
    );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[260px]">Account</TableHead>
            <TableHead className="w-40 text-right">Debit</TableHead>
            <TableHead className="w-40 text-right">Credit</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Remove</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line, index) => {
            const isEquity = equityAccountId !== null && line.account_id === equityAccountId;
            return (
              <TableRow
                key={index}
                className={cn(
                  isEquity && "bg-primary/5",
                  errorRows.has(index) && "bg-destructive/5",
                )}
              >
                <TableCell>
                  <AccountSelect
                    accounts={accounts}
                    value={line.account_id}
                    onChange={(id) => onChange(index, { account_id: id })}
                    className="w-full"
                  />
                  {isEquity && (
                    <p className="mt-1 text-xs font-medium text-primary">{OPENING_EQUITY_LABEL}</p>
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    value={line.debit}
                    onChange={(e) => setAmount(index, "debit", e.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                    aria-label={`Debit on line ${index + 1}`}
                    disabled={disabled}
                    className="text-right font-mono"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={line.credit}
                    onChange={(e) => setAmount(index, "credit", e.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                    aria-label={`Credit on line ${index + 1}`}
                    disabled={disabled}
                    className="text-right font-mono"
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(index)}
                    disabled={disabled}
                    aria-label={`Remove line ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
