"use client";

import { useCallback, useState } from "react";
import { RouteGuard } from "@/components/common/route-guard";
import { DataState } from "@/components/common/data-state";
import { useApiResource } from "@/hooks";
import { creditScoringService } from "@/services";
import { CreditScoringPageHeader } from "../_components/page-header";
import { BranchFilter, FilterBar, branchParam, ALL_BRANCHES } from "../_components/filters";
import { RiskLevelBadge } from "../_components/risk-level-badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import type { CreditScoreHistoryEntry, ScoreHistoryFilters } from "@/types/credit-scoring";

export default function ScoreHistoryPage() {
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetcher = useCallback((): Promise<CreditScoreHistoryEntry[]> => {
    const filters: ScoreHistoryFilters = {
      branch_id: branchParam(branch),
      from: from || undefined,
      to: to || undefined,
    };
    return creditScoringService.getScoreHistory(filters);
  }, [branch, from, to]);

  const resource = useApiResource<CreditScoreHistoryEntry[]>(fetcher);

  return (
    <RouteGuard permission="credit_scoring:view" pageName="Score History">
      <div className="space-y-6">
        <CreditScoringPageHeader
          title="Score History"
          description="Every recorded score change, across all borrowers."
        />

        <FilterBar>
          <BranchFilter value={branch} onChange={setBranch} />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[170px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[170px]" />
          </div>
        </FilterBar>

        <DataState
          resource={resource}
          summary="Score change history across the portfolio will appear here once the backend is connected."
          endpoints={["GET /credit-scoring/score-history"]}
          isEmpty={(rows) => rows.length === 0}
          emptyMessage="No score changes in this range."
        >
          {(rows) => (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Calculated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">Borrower #{row.borrower_id}</TableCell>
                      <TableCell>{row.score}</TableCell>
                      <TableCell><RiskLevelBadge level={row.risk_level} /></TableCell>
                      <TableCell className="capitalize">{row.score_type}</TableCell>
                      <TableCell>{row.reason}</TableCell>
                      <TableCell>{row.model_version}</TableCell>
                      <TableCell>{formatDateTime(row.calculated_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DataState>
      </div>
    </RouteGuard>
  );
}
