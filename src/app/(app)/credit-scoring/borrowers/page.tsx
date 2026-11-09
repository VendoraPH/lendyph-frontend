"use client";

import { useCallback, useState } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { RouteGuard } from "@/components/common/route-guard";
import { DataState } from "@/components/common/data-state";
import { TablePagination } from "@/components/common/table-pagination";
import { useApiResource, usePermission } from "@/hooks";
import { creditScoringService } from "@/services";
import { CREDIT_SCORING_PER_PAGE } from "@/services/credit-scoring.service";
import { CREDIT_SCORING_PER_PAGE_OPTIONS } from "@/lib/credit-scoring/paging";
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
import { MemberCell } from "../_components/member-cell";
import { ScoreCells } from "../_components/score-cells";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { borrowerScoreFilters, yesNoOrDash } from "@/lib/credit-scoring/loan-facts";
import type { BorrowerScoreFilters, BorrowerScoreRow, CreditScoringPage } from "@/types/credit-scoring";

const TREND_LABELS = { up: "Score went up", down: "Score went down", flat: "No change" } as const;

function TrendIcon({ trend }: { trend: BorrowerScoreRow["score_trend"] }) {
  if (trend === null) return <span className="text-muted-foreground">—</span>;
  const label = TREND_LABELS[trend];
  if (trend === "up") return <ArrowUp aria-label={label} className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  if (trend === "down") return <ArrowDown aria-label={label} className="h-4 w-4 text-red-600 dark:text-red-400" />;
  return <Minus aria-label={label} className="h-4 w-4 text-muted-foreground" />;
}

function BorrowerScoresContent() {
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const [riskLevel, setRiskLevel] = useState(ALL_RISK_LEVELS);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(CREDIT_SCORING_PER_PAGE);
  const { can } = usePermission();
  const canViewLoans = can("loans:view");

  const fetcher = useCallback((): Promise<CreditScoringPage<BorrowerScoreRow>> => {
    const filters: BorrowerScoreFilters = {
      branch_id: branchParam(branch),
      risk_level: riskLevelParam(riskLevel),
    };
    return creditScoringService.listBorrowerScores(borrowerScoreFilters(filters, canViewLoans), { page, per_page: perPage });
  }, [branch, riskLevel, page, perPage, canViewLoans]);

  const resource = useApiResource<CreditScoringPage<BorrowerScoreRow>>(fetcher);

  return (
    <div className="space-y-6">
      <CreditScoringPageHeader
        title="Member Scores"
        description="Every member's current Lendy Credit Score and risk level. Scores are advisory only and never change a loan."
      />

      <FilterBar>
        <BranchFilter
          value={branch}
          onChange={(v) => {
            setBranch(v);
            setPage(1);
          }}
        />
        <RiskLevelFilter
          value={riskLevel}
          onChange={(v) => {
            setRiskLevel(v);
            setPage(1);
          }}
        />
      </FilterBar>

      <DataState
        resource={resource}
        summary="The member scores table lists every scored member with their current score, risk level and trend."
        endpoints={["GET /credit-scoring/borrowers"]}
        isEmpty={(res) => res.total === 0}
        emptyMessage="No members match this filter."
      >
        {(res) => (
          <div className="rounded-lg border p-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead>Active Loan</TableHead>
                  <TableHead>Past Due</TableHead>
                  <TableHead>Calculated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {res.data.map((row) => (
                  <TableRow key={row.borrower_id}>
                    <TableCell>
                      <MemberCell row={row} />
                    </TableCell>
                    <TableCell>{row.branch_name ?? "—"}</TableCell>
                    <ScoreCells row={row} />
                    <TableCell>
                      <TrendIcon trend={row.score_trend} />
                    </TableCell>
                    <TableCell>{yesNoOrDash(row.has_active_loan)}</TableCell>
                    <TableCell>{yesNoOrDash(row.past_due)}</TableCell>
                    <TableCell>{row.calculated_at ? formatDate(row.calculated_at) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              page={res.current_page}
              perPage={res.per_page}
              total={res.total}
              perPageOptions={CREDIT_SCORING_PER_PAGE_OPTIONS}
              onPageChange={setPage}
              onPerPageChange={(n) => {
                setPerPage(n);
                setPage(1);
              }}
            />
          </div>
        )}
      </DataState>
    </div>
  );
}

export default function BorrowerScoresPage() {
  return (
    <RouteGuard permission="credit_scoring:view" pageName="Member Scores">
      <BorrowerScoresContent />
    </RouteGuard>
  );
}
