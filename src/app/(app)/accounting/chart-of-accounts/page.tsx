"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  seedNormalBalance,
  type SeedAccount,
} from "@/constants/chart-of-accounts";
import type { AccountType } from "@/types";
import { AccountingPageHeader } from "../_components/page-header";

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
 */
function depthOf(seed: SeedAccount, byCode: Map<string, SeedAccount>): number {
  let depth = 0;
  let parent = seed.parent;
  while (parent) {
    depth += 1;
    parent = byCode.get(parent)?.parent;
  }
  return depth;
}

export default function ChartOfAccountsPage() {
  const [query, setQuery] = useState("");

  const byCode = useMemo(
    () => new Map(DEFAULT_CHART_OF_ACCOUNTS.map((a) => [a.code, a])),
    [],
  );

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    // Searching flattens the tree deliberately. A filtered outline that keeps
    // parents for context ends up showing rows that do not match, which reads
    // as a broken search; a flat list of hits does not.
    const matches = term
      ? DEFAULT_CHART_OF_ACCOUNTS.filter(
          (a) =>
            a.code.includes(term) || a.name.toLowerCase().includes(term),
        )
      : DEFAULT_CHART_OF_ACCOUNTS;
    return matches.map((seed) => ({
      seed,
      depth: term ? 0 : depthOf(seed, byCode),
    }));
  }, [query, byCode]);

  return (
    <RouteGuard permission="chart_of_accounts:view" pageName="Chart of Accounts">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Chart of Accounts"
          description="The account tree every journal entry posts into."
        />

        <Card>
          <CardContent className="space-y-4 pt-6">
            {/*
              Read-only, and labelled as the template rather than as the
              organisation's own chart, because that is what it is: the seed
              list, not yet saved anywhere. Editing arrives with the accounts
              endpoints.
            */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <span className="font-medium">Default template.</span>{" "}
              <span className="text-muted-foreground">
                This is the chart a new organisation is seeded with. It is not
                yet saved to your organisation and cannot be edited here.
              </span>
            </div>

            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search code or name..."
                className="pl-9"
              />
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="w-28">Type</TableHead>
                  <TableHead className="w-32">Normal Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No account matches &ldquo;{query}&rdquo;.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(({ seed, depth }) => (
                    <TableRow key={seed.code}>
                      <TableCell className="font-mono text-xs">{seed.code}</TableCell>
                      <TableCell>
                        <div
                          className={cn(
                            "flex items-center gap-2",
                            seed.is_group && "font-semibold",
                          )}
                          style={{ paddingLeft: depth * 20 }}
                        >
                          {seed.name}
                          {seed.is_contra && (
                            <Badge variant="outline" className="text-[10px]">
                              contra
                            </Badge>
                          )}
                          {seed.cash_kind && (
                            <Badge variant="outline" className="text-[10px]">
                              {seed.cash_kind}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={TYPE_STYLES[seed.type]}>
                          {seed.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm capitalize text-muted-foreground">
                        {/* Group headings never carry a balance of their own. */}
                        {seed.is_group ? "—" : seedNormalBalance(seed)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </RouteGuard>
  );
}
