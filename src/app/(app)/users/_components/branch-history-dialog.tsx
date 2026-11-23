"use client";

import { useEffect, useState } from "react";
import { TablePagination } from "@/components/common";
import { LoadingContent } from "@/components/common/data-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDialogOpening } from "@/hooks";
import { getErrorMessage, httpStatusOf } from "@/lib/api-error";
import { userService } from "@/services";
import type { PaginatedResponse, User, UserBranchHistoryEntry } from "@/types";
import { branchHistoryRows } from "../_lib/branch-history";

const PER_PAGE_OPTIONS = [25, 50, 100] as const;

/** A user out of the caller's reach answers 404, the same as a missing one. */
const OUT_OF_REACH = "You can't see this user's branch history.";

interface Answer {
  key: string;
  body: PaginatedResponse<UserBranchHistoryEntry> | null;
  error: string | null;
}

/**
 * A user's branch history (Phase 6 MB-BE6): their branch assignments and
 * primary-branch changes, newest first, in the server's words. Read afresh
 * each time it opens, a page at a time.
 */
export function BranchHistoryDialog({
  user,
  open,
  onOpenChange,
}: {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(PER_PAGE_OPTIONS[0]);
  const [opened, setOpened] = useState(0);
  if (useDialogOpening(open, user.id)) {
    setPage(1);
    setOpened((n) => n + 1);
  }

  const key = `${user.id}:${page}:${perPage}:${opened}`;
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    if (!open) return;
    let current = true;
    userService
      .branchHistory(user.id, { page, per_page: perPage })
      .then((body) => {
        if (current) setAnswer({ key, body, error: null });
      })
      .catch((err: unknown) => {
        if (!current) return;
        const error =
          httpStatusOf(err) === 404
            ? OUT_OF_REACH
            : getErrorMessage(err, "We couldn't load the branch history. Please try again.");
        setAnswer({ key, body: null, error });
      });
    return () => {
      current = false;
    };
  }, [open, user.id, page, perPage, key]);

  const loading = answer?.key !== key;
  const rows = branchHistoryRows(answer?.body?.data ?? []);
  const meta = answer?.body?.meta;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>Branch History</DialogTitle>
          <DialogDescription>
            {user.full_name}&rsquo;s branch assignments and primary branch changes, newest first.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <LoadingContent />
          ) : answer?.error ? (
            <p className="py-8 text-center text-sm text-muted-foreground" role="alert">
              {answer.error}
            </p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No branch changes are recorded for this user yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">When</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead className="w-40">By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="align-top">
                      <p className="text-sm">{row.date}</p>
                      <p className="text-xs text-muted-foreground">{row.time}</p>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal">
                      <p className="text-xs font-medium text-muted-foreground">{row.change}</p>
                      <p className="text-sm">{row.description}</p>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal text-sm">{row.by}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        {!loading && meta && meta.total > 0 && (
          <TablePagination
            page={meta.current_page}
            perPage={meta.per_page}
            total={meta.total}
            perPageOptions={PER_PAGE_OPTIONS}
            onPageChange={setPage}
            onPerPageChange={(next) => {
              setPerPage(next);
              setPage(1);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
