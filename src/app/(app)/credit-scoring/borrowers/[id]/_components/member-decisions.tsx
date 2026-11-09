"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataState } from "@/components/common/data-state";
import { TablePagination } from "@/components/common/table-pagination";
import { useApiResource } from "@/hooks";
import { creditScoringService } from "@/services";
import { CREDIT_SCORING_PER_PAGE } from "@/services/credit-scoring.service";
import { CREDIT_SCORING_PER_PAGE_OPTIONS } from "@/lib/credit-scoring/paging";
import { DecisionItems } from "../../../_components/decision-list";
import type { CreditDecisionPage } from "@/types/credit-scoring";

/** The member's recorded decisions, paged on the server, newest first. */
export function MemberDecisions({ borrowerId }: { borrowerId: number }) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(CREDIT_SCORING_PER_PAGE);
  const fetcher = useCallback(
    () => creditScoringService.listBorrowerDecisions(borrowerId, { page, per_page: perPage }),
    [borrowerId, page, perPage],
  );
  const resource = useApiResource<CreditDecisionPage>(fetcher);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Decisions</CardTitle>
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          summary="Every decision recorded for this member."
          endpoints={[`GET /credit-scoring/borrowers/${borrowerId}/decisions`]}
          isEmpty={(res) => res.total === 0}
          emptyMessage="No decisions recorded for this member."
        >
          {(res) => (
            <div className="space-y-3">
              <DecisionItems decisions={res.data} showLoan />
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
      </CardContent>
    </Card>
  );
}
