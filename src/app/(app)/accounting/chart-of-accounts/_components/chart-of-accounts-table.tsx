"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { sortAccounts } from "@/lib/accounting/account";
import { cn } from "@/lib/utils";
import type { Account, AccountType } from "@/types";
import { accountTypeLabel, cashKindLabel } from "../../_lib/display-labels";
import { accountBalanceText, accountStatusLabel } from "../_lib/account-form";

const TYPE_STYLES: Record<AccountType, string> = {
  asset: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  liability: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  equity: "bg-purple-500/10 text-purple-700 border-purple-500/30",
  income: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  expense: "bg-rose-500/10 text-rose-700 border-rose-500/30",
};

/**
 * Indent depth, derived from the parent chain rather than stored.
 *
 * The tree is only ever two or three deep and the table is flat, so walking
 * parents on render is cheaper than building and traversing a nested
 * structure — and it cannot fall out of step with the data the way a
 * duplicated `depth` column would.
 *
 * Guarded against a cycle: this walks server data now, not a hand-checked
 * constant, and an account whose parent chain loops would otherwise hang the
 * render rather than merely mis-indent a row.
 */
function depthOf(account: Account, byId: Map<number, Account>): number {
  let depth = 0;
  let parentId = account.parent_id;
  const seen = new Set<number>([account.id]);
  while (parentId != null && !seen.has(parentId)) {
    seen.add(parentId);
    depth += 1;
    parentId = byId.get(parentId)?.parent_id ?? null;
  }
  return depth;
}

interface ChartOfAccountsTableProps {
  accounts: Account[];
  /** Given only when the caller may edit (and the chart is the organisation's own). */
  onEdit?: (account: Account) => void;
  onToggleActive?: (account: Account) => void;
}

/** The account tree as a flat, searchable table, with the server's balances. */
export function ChartOfAccountsTable({ accounts, onEdit, onToggleActive }: ChartOfAccountsTableProps) {
  const hasActions = Boolean(onEdit || onToggleActive);
  const columnCount = hasActions ? 7 : 6;
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => sortAccounts(accounts), [accounts]);
  const byId = useMemo(
    () => new Map(sorted.map((a) => [a.id, a])),
    [sorted],
  );

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    // Searching flattens the tree deliberately. A filtered outline that keeps
    // parents for context ends up showing rows that do not match, which reads
    // as a broken search; a flat list of hits does not.
    const matches = term
      ? sorted.filter(
          (a) =>
            a.code.includes(term) || a.name.toLowerCase().includes(term),
        )
      : sorted;
    return matches.map((account) => ({
      account,
      depth: term ? 0 : depthOf(account, byId),
    }));
  }, [query, sorted, byId]);

  return (
    <>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search code or name..."
          className="pl-9"
          aria-label="Search the chart of accounts"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Code</TableHead>
            <TableHead>Account</TableHead>
            <TableHead className="w-28">Type</TableHead>
            <TableHead className="w-32">Normal Balance</TableHead>
            <TableHead className="w-36 text-right">Balance</TableHead>
            <TableHead className="w-24">Status</TableHead>
            {hasActions && <TableHead className="w-44 text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columnCount}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No account matches &ldquo;{query}&rdquo;.
              </TableCell>
            </TableRow>
          ) : (
            rows.map(({ account, depth }) => (
              <TableRow
                key={account.id}
                className={cn(!account.is_active && "opacity-60")}
              >
                <TableCell className="font-mono text-xs">
                  {account.code}
                </TableCell>
                <TableCell>
                  <div
                    className={cn(
                      "flex items-center gap-2",
                      account.is_group && "font-semibold",
                    )}
                    style={{ paddingLeft: depth * 20 }}
                  >
                    {account.name}
                    {account.is_contra && (
                      <Badge variant="outline" className="text-[10px]">
                        Contra
                      </Badge>
                    )}
                    {account.cash_kind && (
                      <Badge variant="outline" className="text-[10px]">
                        {cashKindLabel(account.cash_kind)}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={TYPE_STYLES[account.type]}>
                    {accountTypeLabel(account.type)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm capitalize text-muted-foreground">
                  {/* Group headings never carry a balance of their own. */}
                  {account.is_group ? "—" : account.normal_balance}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {accountBalanceText(account)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      account.is_active
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                        : "text-muted-foreground",
                    )}
                  >
                    {accountStatusLabel(account)}
                  </Badge>
                </TableCell>
                {hasActions && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {onEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEdit(account)}
                          aria-label={`Edit ${account.code} ${account.name}`}
                        >
                          Edit
                        </Button>
                      )}
                      {onToggleActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onToggleActive(account)}
                          aria-label={`${account.is_active ? "Deactivate" : "Reactivate"} ${account.code} ${account.name}`}
                        >
                          {account.is_active ? "Deactivate" : "Reactivate"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}
