"use client";

import { useEffect, useState } from "react";
import { Search, Loader2, Plus, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TablePagination } from "@/components/common";
import { useGCashNonMembers } from "@/hooks";
import { gcashService } from "@/services/gcash.service";
import { extractGCashErrorMessage } from "@/lib/gcash-errors";
import type { GCashNonMember } from "@/types";
import { CashInDialog } from "./cash-in-dialog";
import { CashOutDialog } from "./cash-out-dialog";
import { NonMemberFormDialog } from "./non-member-form-dialog";

type DialogState =
  | { type: "cash_in" | "cash_out"; nonMember: GCashNonMember }
  | { type: "form"; nonMember: GCashNonMember | null }
  | { type: "delete"; nonMember: GCashNonMember }
  | null;

export function NonMembersTab() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleting, setDeleting] = useState(false);

  const { nonMembers, total, loading, error, refresh } = useGCashNonMembers({
    search: debounced,
    page,
    perPage,
  });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // A narrower search can strand you past the last page of results.
  useEffect(() => setPage(1), [debounced, perPage]);

  const handleDelete = async (nonMember: GCashNonMember) => {
    setDeleting(true);
    try {
      await gcashService.deleteNonMember(nonMember.id);
      toast.success(`${nonMember.full_name} removed.`);
      setDialog(null);
      refresh();
    } catch (err) {
      toast.error(extractGCashErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search non-members by name or mobile…"
            className="pl-8"
          />
        </div>
        <Button onClick={() => setDialog({ type: "form", nonMember: null })}>
          <Plus className="h-4 w-4" />
          Add Non-Member
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Mobile Number</TableHead>
              <TableHead>ID Presented</TableHead>
              <TableHead className="text-right w-[300px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <Loader2 className="inline h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-destructive py-8"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : nonMembers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  {debounced
                    ? "No non-members match that search."
                    : "No non-members yet. Add a walk-in customer to get started."}
                </TableCell>
              </TableRow>
            ) : (
              nonMembers.map((nm) => (
                <TableRow key={nm.id}>
                  <TableCell>{nm.full_name}</TableCell>
                  <TableCell>{nm.mobile_number}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {nm.id_type} · {nm.id_number}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        setDialog({ type: "cash_in", nonMember: nm })
                      }
                    >
                      Cash In
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDialog({ type: "cash_out", nonMember: nm })
                      }
                    >
                      Cash Out
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`More actions for ${nm.full_name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            setDialog({ type: "form", nonMember: nm })
                          }
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() =>
                            setDialog({ type: "delete", nonMember: nm })
                          }
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
          party={{
            kind: "non_member",
            id: dialog.nonMember.id,
            full_name: dialog.nonMember.full_name,
            mobile_number: dialog.nonMember.mobile_number,
          }}
          onCreated={() => setDialog(null)}
        />
      )}

      {dialog?.type === "cash_out" && (
        <CashOutDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          party={{
            kind: "non_member",
            id: dialog.nonMember.id,
            full_name: dialog.nonMember.full_name,
            mobile_number: dialog.nonMember.mobile_number,
          }}
          onCreated={() => setDialog(null)}
        />
      )}

      {dialog?.type === "form" && (
        <NonMemberFormDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          nonMember={dialog.nonMember}
          onSaved={refresh}
        />
      )}

      {dialog?.type === "delete" && (
        <AlertDialog
          open
          onOpenChange={(o) => {
            if (!o && !deleting) setDialog(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Remove {dialog.nonMember.full_name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                They will no longer appear in the non-member list. Transactions
                already recorded for them are kept.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                onClick={() => handleDelete(dialog.nonMember)}
              >
                {deleting ? "Removing…" : "Remove"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
