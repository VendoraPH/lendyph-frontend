"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, BookOpen } from "lucide-react";
import { reportService } from "@/services";

interface LedgerEntry {
  id: number;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  reference?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface LedgerTabProps {
  borrowerId: number;
}

export function LedgerTab({ borrowerId }: LedgerTabProps) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      const data = await reportService.subsidiaryLedger(borrowerId);
      const items = Array.isArray(data) ? data as LedgerEntry[] : [];
      setEntries(items);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [borrowerId]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <BookOpen className="h-8 w-8 opacity-40" />
            <p className="text-sm">No ledger entries found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-sm">{formatDate(entry.date)}</TableCell>
                  <TableCell className="text-sm font-medium">{entry.description}</TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">{entry.reference || "—"}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {entry.debit > 0 ? formatCurrency(entry.debit) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-green-600">
                    {entry.credit > 0 ? formatCurrency(entry.credit) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums font-semibold">
                    {formatCurrency(entry.balance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
