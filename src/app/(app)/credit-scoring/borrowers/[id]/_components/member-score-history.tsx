"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataState } from "@/components/common/data-state";
import { TablePagination } from "@/components/common/table-pagination";
import { useApiResource } from "@/hooks";
import { creditScoringService } from "@/services";
import { CREDIT_SCORING_PER_PAGE } from "@/services/credit-scoring.service";
import { CREDIT_SCORING_PER_PAGE_OPTIONS } from "@/lib/credit-scoring/paging";
import { ScoreHistoryTable } from "../../../_components/score-history-table";
import type { CreditScoreHistoryEntry, CreditScoringPage } from "@/types/credit-scoring";

/** The member's own score history, paged on the server, newest first. */
export function MemberScoreHistory({ borrowerId }: { borrowerId: number }) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(CREDIT_SCORING_PER_PAGE);
  const fetcher = useCallback(
    () => creditScoringService.getBorrowerScoreHistory(borrowerId, { page, per_page: perPage }),
    [borrowerId, page, perPage],
  );
  const resource = useApiResource<CreditScoringPage<CreditScoreHistoryEntry>>(fetcher);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">All Scores</CardTitle>
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          summary="Every score recorded for this member."
          endpoints={[`GET /credit-scoring/borrowers/${borrowerId}/history`]}
          isEmpty={(res) => res.total === 0}
          emptyMessage="No scores recorded yet."
        >
          {(res) => (
            <>
              <ScoreHistoryTable rows={res.data} showMember={false} />
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
            </>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}
