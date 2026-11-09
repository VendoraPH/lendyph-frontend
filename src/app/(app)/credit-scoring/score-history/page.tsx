"use client";

import { useCallback, useState } from "react";
import { RouteGuard } from "@/components/common/route-guard";
import { DataState } from "@/components/common/data-state";
import { TablePagination } from "@/components/common/table-pagination";
import { useApiResource } from "@/hooks";
import { creditScoringService } from "@/services";
import { CREDIT_SCORING_PER_PAGE } from "@/services/credit-scoring.service";
import { CREDIT_SCORING_PER_PAGE_OPTIONS } from "@/lib/credit-scoring/paging";
import { CreditScoringPageHeader } from "../_components/page-header";
import { BranchFilter, FilterBar, branchParam, ALL_BRANCHES } from "../_components/filters";
import { ScoreHistoryTable } from "../_components/score-history-table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { CreditScoreHistoryEntry, CreditScoringPage, ScoreHistoryFilters } from "@/types/credit-scoring";

function ScoreHistoryContent() {
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(CREDIT_SCORING_PER_PAGE);

  const fetcher = useCallback((): Promise<CreditScoringPage<CreditScoreHistoryEntry>> => {
    const filters: ScoreHistoryFilters = {
      branch_id: branchParam(branch),
      from: from || undefined,
      to: to || undefined,
    };
    return creditScoringService.getScoreHistory(filters, { page, per_page: perPage });
  }, [branch, from, to, page, perPage]);

  const resource = useApiResource<CreditScoringPage<CreditScoreHistoryEntry>>(fetcher);

  return (
    <div className="space-y-6">
      <CreditScoringPageHeader
        title="Score History"
        description="Every recorded member score, newest first. A loan application's own scores are on that loan's Credit Assessment."
      />

      <FilterBar>
        <BranchFilter
          value={branch}
          onChange={(v) => {
            setBranch(v);
            setPage(1);
          }}
        />
        <div className="space-y-1.5">
          <Label htmlFor="score-history-from" className="text-xs text-muted-foreground">From</Label>
          <Input
            id="score-history-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="w-[170px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="score-history-to" className="text-xs text-muted-foreground">To</Label>
          <Input
            id="score-history-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="w-[170px]"
          />
        </div>
      </FilterBar>

      <DataState
        resource={resource}
        summary="Score history across the portfolio, newest first."
        endpoints={["GET /credit-scoring/score-history"]}
        isEmpty={(res) => res.total === 0}
        emptyMessage="No scores in this range."
      >
        {(res) => (
          <div className="rounded-lg border p-2">
            <ScoreHistoryTable rows={res.data} />
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

export default function ScoreHistoryPage() {
  return (
    <RouteGuard permission="credit_scoring:view" pageName="Score History">
      <ScoreHistoryContent />
    </RouteGuard>
  );
}
