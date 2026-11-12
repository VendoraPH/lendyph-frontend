"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Minus, Search } from "lucide-react";
import { RouteGuard } from "@/components/common/route-guard";
import { DataState } from "@/components/common/data-state";
import { TablePagination } from "@/components/common/table-pagination";
import { useApiResource, usePermission } from "@/hooks";
import { SEARCH_DEBOUNCE_MS } from "@/hooks/use-search-page";
import { creditScoringService } from "@/services";
import { CREDIT_SCORING_PER_PAGE } from "@/services/credit-scoring.service";
import { CREDIT_SCORING_PER_PAGE_OPTIONS } from "@/lib/credit-scoring/paging";
import { CreditScoringPageHeader } from "../_components/page-header";
import {
  BranchFilter,
  RiskLevelFilter,
  TrendFilter,
  MemberTypeFilter,
  LoanProductFilter,
  FilterBar,
  branchParam,
  riskLevelParam,
  optionParam,
  loanProductParam,
  ALL_BRANCHES,
  ALL_RISK_LEVELS,
  ALL_OPTIONS,
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
import { MEMBER_SEARCH_MAX, memberSearchParam } from "@/lib/credit-scoring/member-search";
import { SCORE_TREND_LABELS } from "@/lib/credit-scoring/labels";
import { pesosOrDash } from "@/lib/credit-scoring/money";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  BorrowerScoreFilters,
  BorrowerScoreRow,
  CreditScoringPage,
  MemberType,
  ScoreTrend,
} from "@/types/credit-scoring";

function TrendIcon({ trend }: { trend: BorrowerScoreRow["score_trend"] }) {
  if (trend === null) return <span className="text-muted-foreground">—</span>;
  const label = SCORE_TREND_LABELS[trend];
  if (trend === "up") return <ArrowUp aria-label={label} className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  if (trend === "down") return <ArrowDown aria-label={label} className="h-4 w-4 text-red-600 dark:text-red-400" />;
  return <Minus aria-label={label} className="h-4 w-4 text-muted-foreground" />;
}

function BorrowerScoresContent() {
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const [riskLevel, setRiskLevel] = useState(ALL_RISK_LEVELS);
  const [trend, setTrend] = useState(ALL_OPTIONS);
  const [memberType, setMemberType] = useState(ALL_OPTIONS);
  const [loanProduct, setLoanProduct] = useState(ALL_OPTIONS);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(CREDIT_SCORING_PER_PAGE);
  const { can } = usePermission();
  const canViewLoans = can("loans:view");

  // The search goes to the server once typing settles, from page one.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetcher = useCallback((): Promise<CreditScoringPage<BorrowerScoreRow>> => {
    const filters: BorrowerScoreFilters = {
      branch_id: branchParam(branch),
      risk_level: riskLevelParam(riskLevel),
      trend: optionParam<ScoreTrend>(trend),
      member_type: optionParam<MemberType>(memberType),
      loan_product_id: loanProductParam(loanProduct),
      search: memberSearchParam(search),
    };
    return creditScoringService.listBorrowerScores(borrowerScoreFilters(filters, canViewLoans), { page, per_page: perPage });
  }, [branch, riskLevel, trend, memberType, loanProduct, search, page, perPage, canViewLoans]);

  const resource = useApiResource<CreditScoringPage<BorrowerScoreRow>>(fetcher);

  return (
    <div className="space-y-6">
      <CreditScoringPageHeader
        title="Member Scores"
        description="Every member's current Lendy Credit Score and risk level. Scores are advisory only and never change a loan."
      />

      <FilterBar>
        <div className="space-y-1.5">
          <Label htmlFor="member-score-search" className="text-xs text-muted-foreground">
            Search
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="member-score-search"
              type="search"
              value={searchInput}
              maxLength={MEMBER_SEARCH_MAX}
              placeholder="Name or member code"
              className="w-[240px] pl-9"
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>
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
        <TrendFilter
          value={trend}
          onChange={(v) => {
            setTrend(v);
            setPage(1);
          }}
        />
        <MemberTypeFilter
          value={memberType}
          onChange={(v) => {
            setMemberType(v);
            setPage(1);
          }}
        />
        {canViewLoans && (
          <LoanProductFilter
            value={loanProduct}
            onChange={(v) => {
              setLoanProduct(v);
              setPage(1);
            }}
          />
        )}
      </FilterBar>

      <DataState
        resource={resource}
        summary="The member scores table lists every scored member with their current score, risk level, trend and outstanding balance."
        endpoints={["GET /credit-scoring/borrowers"]}
        isEmpty={(res) => res.total === 0}
        emptyMessage="No members match this search or filter."
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
                  <TableHead className="text-right">Outstanding</TableHead>
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
                    <TableCell className="text-right tabular-nums">{pesosOrDash(row.outstanding)}</TableCell>
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
