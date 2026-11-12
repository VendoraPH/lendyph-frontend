"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Check, Undo2, X } from "lucide-react";
import { BranchFilter, ALL_BRANCHES, branchIdParam } from "@/components/common/branch-filter";
import { DataState } from "@/components/common/data-state";
import { TablePagination } from "@/components/common/table-pagination";
import { Badge } from "@/components/ui/badge";
import { PermissionButton } from "@/components/common/permission-button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { formatDate, formatDateTime } from "@/lib/format";
import { savingsApprovalService } from "@/services";
import { useAuthStore } from "@/store";
import type { SavingsApproval, SavingsApprovalKind, SavingsApprovalStatus } from "@/types";
import { ActionButton } from "../../_components/action-button";
import { OptionSelect } from "../../_components/option-select";
import { APPROVAL_KIND_LABELS, APPROVAL_STATUS_LABELS, actorName, labelOf } from "../../_lib/savings-rules";
import {
  approvalAmountText,
  approvalFeeText,
  approvalHref,
  approvalOffer,
  approvalProgress,
  approvalSubject,
} from "../_lib/approval-rules";
import { DecideDialog, type Decision } from "./decide-dialog";

const STATUSES: SavingsApprovalStatus[] = ["pending", "approved", "rejected", "cancelled", "expired"];
const KIND_OPTIONS = [
  { value: "all", label: "All requests" },
  ...(Object.keys(APPROVAL_KIND_LABELS) as SavingsApprovalKind[]).map((k) => ({ value: k, label: APPROVAL_KIND_LABELS[k] })),
];

/**
 * The savings approvals queue: withdrawals, closes, time-deposit payouts and
 * pre-terminations above the first tier, and every reversal request. Nothing
 * moves until a different user approves; pending requests expire at the end
 * of the business day.
 */
export function ApprovalsScreen() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [status, setStatus] = useState<SavingsApprovalStatus>("pending");
  const [kind, setKind] = useState("all");
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [deciding, setDeciding] = useState<{ approval: SavingsApproval; decision: Decision } | null>(null);

  const fetcher = useCallback(
    () =>
      savingsApprovalService.list({
        page,
        per_page: perPage,
        status,
        kind: kind === "all" ? undefined : kind,
        branch_id: branchIdParam(branch),
      }),
    [page, perPage, status, kind, branch],
  );
  const resource = useApiResource(fetcher);
  const stats = resource.data?.meta.stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Savings Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Requests above the approval amount, and reversal requests. The person who made a request can&apos;t
          decide it. Pending requests expire at the end of the business day.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(v as SavingsApprovalStatus);
            setPage(1);
          }}
        >
          <TabsList>
            {STATUSES.map((s) => (
              <TabsTrigger key={s} value={s}>
                {APPROVAL_STATUS_LABELS[s]}
                {stats && <span className="ml-1 text-xs text-muted-foreground">{stats[s] ?? 0}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          <OptionSelect
            value={kind}
            onChange={(v) => {
              setKind(v);
              setPage(1);
            }}
            options={KIND_OPTIONS}
            className="w-56"
          />
          <BranchFilter
            value={branch}
            onChange={(v) => {
              setBranch(v);
              setPage(1);
            }}
            className="w-56"
          />
        </div>
      </div>

      <DataState
        resource={resource}
        endpoints={["GET /savings/approvals"]}
        summary="Requests waiting for approval will be listed here once the savings service is connected."
        isEmpty={(res) => res.data.length === 0}
        emptyMessage={status === "pending" ? "Nothing is waiting for approval." : "No requests here."}
      >
        {(res) => (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requested</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Requested by</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-0">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {res.data.map((a) => {
                    const offer = approvalOffer(a, userId);
                    const href = approvalHref(a);
                    const progress = approvalProgress(a);
                    return (
                      <TableRow key={a.id}>
                        <TableCell>
                          {a.created_at ? formatDateTime(a.created_at) : "—"}
                          {a.status === "pending" && a.expires_at && (
                            <span className="block text-xs text-muted-foreground">Expires {formatDateTime(a.expires_at)}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {labelOf(APPROVAL_KIND_LABELS, a.kind)}
                          {a.check_reason && (
                            <span className="block max-w-56 text-xs text-muted-foreground">{a.check_reason}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {href ? (
                            <Link href={href} className="hover:underline">
                              {approvalSubject(a)}
                            </Link>
                          ) : (
                            approvalSubject(a)
                          )}
                        </TableCell>
                        <TableCell>
                          {a.borrower_name ?? "—"}
                          {a.branch_name && <span className="block text-xs text-muted-foreground">{a.branch_name}</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {approvalAmountText(a)}
                          {approvalFeeText(a) && (
                            <span className="block text-xs text-muted-foreground">{approvalFeeText(a)}</span>
                          )}
                        </TableCell>
                        <TableCell>{actorName(a.requested_by)}</TableCell>
                        <TableCell>
                          <Badge variant={a.status === "pending" ? "secondary" : "outline"}>
                            {labelOf(APPROVAL_STATUS_LABELS, a.status)}
                          </Badge>
                          {progress && <span className="block text-xs text-muted-foreground">{progress}</span>}
                          {a.decided_by && (
                            <span className="block text-xs text-muted-foreground">
                              {actorName(a.decided_by)}
                              {a.decided_at ? `, ${formatDate(a.decided_at)}` : ""}
                            </span>
                          )}
                          {a.decision_reason && (
                            <span className="block max-w-48 truncate text-xs text-muted-foreground">{a.decision_reason}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {a.status === "pending" && (
                            <div className="flex justify-end gap-1">
                              <ActionButton
                                permission="savings:approve"
                                size="sm"
                                blockedReason={offer.approveBlocked}
                                onClick={() => setDeciding({ approval: a, decision: "approve" })}
                              >
                                <Check className="h-4 w-4" /> Approve
                              </ActionButton>
                              <ActionButton
                                permission="savings:approve"
                                size="sm"
                                variant="outline"
                                blockedReason={offer.rejectBlocked}
                                onClick={() => setDeciding({ approval: a, decision: "reject" })}
                              >
                                <X className="h-4 w-4" /> Reject
                              </ActionButton>
                              {offer.canCancel && (
                                <PermissionButton
                                  permission="savings:transact"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeciding({ approval: a, decision: "cancel" })}
                                >
                                  <Undo2 className="h-4 w-4" /> Cancel
                                </PermissionButton>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              page={page}
              perPage={perPage}
              total={res.meta.total}
              onPageChange={setPage}
              onPerPageChange={(n) => {
                setPerPage(n);
                setPage(1);
              }}
            />
          </div>
        )}
      </DataState>

      <DecideDialog
        approval={deciding?.approval ?? null}
        decision={deciding?.decision ?? "approve"}
        onOpenChange={(open) => !open && setDeciding(null)}
        onDecided={() => resource.refetch()}
      />
    </div>
  );
}
