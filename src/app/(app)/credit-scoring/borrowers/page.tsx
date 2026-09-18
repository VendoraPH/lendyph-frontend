"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { RouteGuard } from "@/components/common/route-guard";
import { DataState } from "@/components/common/data-state";
import { useApiResource } from "@/hooks";
import { creditScoringService } from "@/services";
import { CreditScoringPageHeader } from "../_components/page-header";
import {
  BranchFilter,
  RiskLevelFilter,
  FilterBar,
  branchParam,
  riskLevelParam,
  ALL_BRANCHES,
  ALL_RISK_LEVELS,
} from "../_components/filters";
import { RiskLevelBadge } from "../_components/risk-level-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { BorrowerScoreFilters, BorrowerScoreRow } from "@/types/credit-scoring";

function TrendIcon({ trend }: { trend: BorrowerScoreRow["score_trend"] }) {
  if (trend === "up") return <ArrowUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  if (trend === "down") return <ArrowDown className="h-4 w-4 text-red-600 dark:text-red-400" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export default function BorrowerScoresPage() {
  const router = useRouter();
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const [riskLevel, setRiskLevel] = useState(ALL_RISK_LEVELS);

  const fetcher = useCallback((): Promise<BorrowerScoreRow[]> => {
    const filters: BorrowerScoreFilters = {
      branch_id: branchParam(branch),
      risk_level: riskLevelParam(riskLevel),
    };
    return creditScoringService.listBorrowerScores(filters);
  }, [branch, riskLevel]);

  const resource = useApiResource<BorrowerScoreRow[]>(fetcher);

  return (
    <RouteGuard permission="credit_scoring:view" pageName="Borrower Scores">
      <div className="space-y-6">
        <CreditScoringPageHeader
          title="Borrower Scores"
          description="Every borrower's current Lendy Credit Score and risk level."
        />

        <FilterBar>
          <BranchFilter value={branch} onChange={setBranch} />
          <RiskLevelFilter value={riskLevel} onChange={setRiskLevel} />
        </FilterBar>

        <DataState
          resource={resource}
          summary="The borrower scores table will list every scored borrower with their current score, risk level, and trend once the backend is connected."
          endpoints={["GET /credit-scoring/borrowers"]}
          isEmpty={(rows) => rows.length === 0}
          emptyMessage="No borrowers match this filter."
        >
          {(rows) => (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Trend</TableHead>
                    <TableHead>Active Loan</TableHead>
                    <TableHead>Calculated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.borrower_id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/credit-scoring/borrowers/${row.borrower_id}`)}
                    >
                      <TableCell className="font-medium">{row.borrower_name}</TableCell>
                      <TableCell>{row.branch_name}</TableCell>
                      <TableCell>{row.score}</TableCell>
                      <TableCell><RiskLevelBadge level={row.risk_level} /></TableCell>
                      <TableCell><TrendIcon trend={row.score_trend} /></TableCell>
                      <TableCell>{row.has_active_loan ? "Yes" : "No"}</TableCell>
                      <TableCell>{formatDate(row.calculated_at)}</TableCell>
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
