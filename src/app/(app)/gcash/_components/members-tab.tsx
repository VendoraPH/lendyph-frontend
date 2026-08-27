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
import { borrowerService } from "@/services/borrower.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import type { Borrower } from "@/types";
import { CashInDialog } from "./cash-in-dialog";
import { CashOutDialog } from "./cash-out-dialog";

type DialogState =
  | { type: "cash_in"; borrower: Borrower }
  | { type: "cash_out"; borrower: Borrower }
  | null;

export function MembersTab() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [members, setMembers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

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
          per_page: 25,
        });
        if (cancelled) return;
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        setMembers(list);
      } catch (err) {
        toast.error(extractGCashErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members by name or code…"
            className="pl-8"
          />
        </div>
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
                        setDialog({ type: "cash_in", borrower: b })
                      }
                    >
                      Cash In
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDialog({ type: "cash_out", borrower: b })
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

      {dialog?.type === "cash_in" && (
        <CashInDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          borrower={{
            id: dialog.borrower.id,
            full_name: dialog.borrower.full_name ?? "",
            borrower_code: dialog.borrower.borrower_code ?? undefined,
          }}
          onCreated={() => setDialog(null)}
        />
      )}
      {dialog?.type === "cash_out" && (
        <CashOutDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          borrower={{
            id: dialog.borrower.id,
            full_name: dialog.borrower.full_name ?? "",
            borrower_code: dialog.borrower.borrower_code ?? undefined,
          }}
          onCreated={() => setDialog(null)}
        />
      )}
    </div>
  );
}
