"use client";

import { useEffect, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { TablePagination } from "@/components/common";
import { borrowerService } from "@/services/borrower.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import { borrowerParty } from "@/lib/gcash-party";
import type { Borrower, GCashParty } from "@/types";
import { CashInDialog } from "./cash-in-dialog";
import { CashOutDialog } from "./cash-out-dialog";
import { NewTransactionDialog } from "./new-transaction-dialog";

type DialogState =
  | { type: "cash_in" | "cash_out"; party: GCashParty }
  | { type: "new_transaction" }
  | null;

export function MembersTab() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [members, setMembers] = useState<Borrower[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // A narrower search can strand you past the last page of results.
  useEffect(() => setPage(1), [debounced, perPage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await borrowerService.list({
          // Every row here renders Cash In / Cash Out, so non-members
          // (pending, rejected) must not reach the table at all.
          members_only: 1,
          search: debounced || undefined,
          page,
          per_page: perPage,
        });
        if (cancelled) return;
        // This is one PAGE, deliberately — the table pages through the rest
        // below. It must never be handed to a picker as if it were the whole
        // membership: `NewTransactionDialog` drains its own list for exactly
        // that reason.
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        setMembers(list);
        setTotal(Array.isArray(res) ? list.length : (res?.meta?.total ?? 0));
      } catch (err) {
        toast.error(extractGCashErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, page, perPage]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members by name or code…"
            className="pl-8"
          />
        </div>
        <Button onClick={() => setDialog({ type: "new_transaction" })}>
          New Transaction
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member Code</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead className="text-right w-[260px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  <Loader2 className="inline h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-muted-foreground py-8"
                >
                  No members found.
                </TableCell>
              </TableRow>
            ) : (
              members.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">
                    {b.borrower_code ?? "—"}
                  </TableCell>
                  <TableCell>{b.full_name ?? "—"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        setDialog({ type: "cash_in", party: borrowerParty(b) })
                      }
                    >
                      Cash In
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDialog({ type: "cash_out", party: borrowerParty(b) })
                      }
                    >
                      Cash Out
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={page}
        perPage={perPage}
        total={total}
        onPageChange={setPage}
        onPerPageChange={setPerPage}
      />

      {dialog?.type === "cash_in" && (
        <CashInDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          party={dialog.party}
          onCreated={() => setDialog(null)}
        />
      )}
      {dialog?.type === "cash_out" && (
        <CashOutDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          party={dialog.party}
          onCreated={() => setDialog(null)}
        />
      )}
      {dialog?.type === "new_transaction" && (
        <NewTransactionDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          onCreated={() => setDialog(null)}
        />
      )}
    </div>
  );
}
