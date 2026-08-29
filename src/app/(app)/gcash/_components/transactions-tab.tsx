"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { gcashService } from "@/services/gcash.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  GCashListFilters,
  GCashTransaction,
  GCashTransactionStatus,
  GCashTransactionType,
} from "@/types";
import { PaidButton } from "./paid-button";
import { PartyCell } from "./party-cell";

const TYPE_OPTIONS: { value: GCashTransactionType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "cash_in", label: "Cash In" },
  { value: "cash_out", label: "Cash Out" },
];
const STATUS_OPTIONS: {
  value: GCashTransactionStatus | "all";
  label: string;
}[] = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "completed", label: "Completed" },
];

function statusBadge(s: GCashTransactionStatus) {
  if (s === "pending") return <Badge variant="destructive">Pending</Badge>;
  if (s === "paid") return <Badge>Paid</Badge>;
  return <Badge variant="secondary">Completed</Badge>;
}

export function TransactionsTab() {
  const [filters, setFilters] = useState<{
    type: GCashTransactionType | "all";
    status: GCashTransactionStatus | "all";
    start_date: string;
    end_date: string;
  }>({
    type: "all",
    status: "all",
    start_date: "",
    end_date: "",
  });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<GCashTransaction[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params: GCashListFilters = { page, per_page: 25 };
        if (filters.type !== "all") params.type = filters.type;
        if (filters.status !== "all") params.status = filters.status;
        if (filters.start_date) params.start_date = filters.start_date;
        if (filters.end_date) params.end_date = filters.end_date;

        const res = await gcashService.listTransactions(params);
        if (cancelled) return;
        setRows(res?.data ?? []);
        setTotalPages(res?.meta?.last_page ?? 1);
      } catch (err) {
        toast.error(extractGCashErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters, page, reloadToken]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Type</label>
          <Select
            value={filters.type}
            onValueChange={(v) =>
              setFilters((p) => ({
                ...p,
                type: v as GCashTransactionType | "all",
              }))
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select
            value={filters.status}
            onValueChange={(v) =>
              setFilters((p) => ({
                ...p,
                status: v as GCashTransactionStatus | "all",
              }))
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input
            type="date"
            value={filters.start_date}
            onChange={(e) =>
              setFilters((p) => ({ ...p, start_date: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input
            type="date"
            value={filters.end_date}
            onChange={(e) =>
              setFilters((p) => ({ ...p, end_date: e.target.value }))
            }
          />
        </div>

        <Button variant="ghost" onClick={refresh}>
          Refresh
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Charge</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Transactor</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <Loader2 className="inline h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-center text-muted-foreground py-8"
                >
                  No transactions found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.transaction_date)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.reference_no}
                  </TableCell>
                  <TableCell>
                    <PartyCell borrower={r.borrower} nonMember={r.non_member} />
                  </TableCell>
                  <TableCell>
                    {r.type === "cash_in" ? "Cash In" : "Cash Out"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(r.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(r.charge_amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(r.total_amount)}
                  </TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell>{r.transactor_user?.full_name ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {r.type === "cash_in" && r.status === "pending" && (
                      <PaidButton
                        transactionId={r.id}
                        referenceNo={r.reference_no}
                        onPaid={refresh}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-2 items-center text-sm">
        <span className="text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
