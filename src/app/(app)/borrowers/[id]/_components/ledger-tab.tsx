"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, BookOpen, FileText } from "lucide-react";
import { toast } from "sonner";
import { borrowerService, reportService } from "@/services";
import { formatCurrency } from "@/lib/format";
import type { BorrowerLedgerEntry, PaginatedResponse } from "@/types";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface LedgerTabProps {
  borrowerId: number;
}

export function LedgerTab({ borrowerId }: LedgerTabProps) {
  const [entries, setEntries] = useState<BorrowerLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [subsidiaryLoading, setSubsidiaryLoading] = useState(false);
  const [subsidiary, setSubsidiary] = useState<Record<string, unknown> | null>(null);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await borrowerService.ledger(borrowerId, { per_page: 200 });
      const items = Array.isArray(res)
        ? (res as BorrowerLedgerEntry[])
        : (res as PaginatedResponse<BorrowerLedgerEntry>)?.data ?? [];
      setEntries(items);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [borrowerId]);

  const handleViewSubsidiaryLedger = useCallback(async () => {
    setSubsidiaryLoading(true);
    try {
      const res = await reportService.subsidiaryLedger(borrowerId);
      const payload = (res && typeof res === "object" && "data" in (res as Record<string, unknown>)
        ? (res as { data: unknown }).data
        : res) as Record<string, unknown> | null;
      setSubsidiary(payload ?? {});
      toast.success("Subsidiary ledger loaded");
    } catch {
      toast.error("Failed to load subsidiary ledger");
      setSubsidiary(null);
    } finally {
      setSubsidiaryLoading(false);
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
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Subsidiary Ledger Report
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewSubsidiaryLedger}
            disabled={subsidiaryLoading}
          >
            {subsidiaryLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                {subsidiary ? "Refresh" : "Load Report"}
              </>
            )}
          </Button>
        </CardHeader>
        {subsidiary && (
          <CardContent className="pt-0">
            <pre className="max-h-[40vh] overflow-auto rounded-md bg-muted/50 p-3 text-[11px] leading-relaxed font-mono">
              {JSON.stringify(subsidiary, null, 2)}
            </pre>
          </CardContent>
        )}
      </Card>
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
              {entries.map((entry) => {
                const isDebit = entry.type === "debit";
                const reference =
                  entry.reference_type && entry.reference_id
                    ? `${entry.reference_type} #${entry.reference_id}`
                    : "—";
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">{formatDate(entry.date)}</TableCell>
                    <TableCell className="text-sm font-medium">{entry.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">{reference}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {isDebit ? formatCurrency(entry.amount) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-green-600">
                      {!isDebit ? formatCurrency(entry.amount) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-semibold">
                      {formatCurrency(entry.running_balance)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        </CardContent>
      </Card>
    </div>
  );
}
