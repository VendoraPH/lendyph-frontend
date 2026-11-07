"use client";

import { useCallback } from "react";
import { useApiResource } from "@/hooks";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { savingsAccountService } from "@/services/savings-account.service";
import { ACCOUNT_STATUS_LABEL } from "../../../_lib/account-status";

function Rows({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {head.map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>{children}</TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Every status change with its reason and who made it. */
export function StatusHistory({ accountId }: { accountId: number }) {
  const fetcher = useCallback(() => savingsAccountService.statusHistory(accountId), [accountId]);
  const resource = useApiResource(fetcher);
  return (
    <DataState
      resource={resource}
      summary="Each status change on this account, its reason and who made it."
      endpoints={["GET /savings/accounts/{id}/status-history"]}
      isEmpty={(d) => d.length === 0}
      emptyMessage="The status has never changed."
    >
      {(rows) => (
        <Rows head={["When", "From", "To", "Reason", "By"]}>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap">{formatDateTime(r.created_at)}</TableCell>
              <TableCell>{r.from_status ? ACCOUNT_STATUS_LABEL[r.from_status] : "—"}</TableCell>
              <TableCell>{ACCOUNT_STATUS_LABEL[r.to_status]}</TableCell>
              <TableCell className="max-w-xs whitespace-normal">{r.reason}</TableCell>
              <TableCell>{r.user?.name ?? "—"}</TableCell>
            </TableRow>
          ))}
        </Rows>
      )}
    </DataState>
  );
}

/** The audit trail: what changed, from what to what, by whom. */
export function AuditLog({ accountId }: { accountId: number }) {
  const fetcher = useCallback(() => savingsAccountService.audit(accountId), [accountId]);
  const resource = useApiResource(fetcher);
  return (
    <DataState
      resource={resource}
      summary="Who did what to this account and when, with the old and new values."
      endpoints={["GET /savings/accounts/{id}/audit"]}
      isEmpty={(d) => d.length === 0}
      emptyMessage="Nothing recorded yet."
    >
      {(rows) => (
        <Rows head={["When", "Action", "Record", "Old", "New", "Reference", "By"]}>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap">{formatDateTime(r.created_at)}</TableCell>
              <TableCell>{r.action}</TableCell>
              <TableCell>{r.record}</TableCell>
              <TableCell className="max-w-48 truncate">{r.old_value ?? "—"}</TableCell>
              <TableCell className="max-w-48 truncate">{r.new_value ?? "—"}</TableCell>
              <TableCell className="font-mono text-xs">{r.reference_number ?? "—"}</TableCell>
              <TableCell>{r.user?.name ?? "—"}</TableCell>
            </TableRow>
          ))}
        </Rows>
      )}
    </DataState>
  );
}
