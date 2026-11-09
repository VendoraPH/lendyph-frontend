"use client";

import { useCallback, useState } from "react";
import { RouteGuard } from "@/components/common";
import { useAccountingResource } from "@/hooks";
import { accountingService } from "@/services";
import { todayISO } from "@/lib/format";
import type { LoanAccountingSummary } from "@/types";
import { AccountingPageHeader } from "../_components/page-header";
import { DataState } from "../_components/data-state";
import {
  ALL_BRANCHES,
  BranchFilter,
  DateFilter,
  FilterBar,
  branchParam,
} from "../_components/accounting-filters";
import { AgingTable } from "./_components/aging-table";
import { LoansByAge } from "./_components/loans-by-age";
import { PostingRulesCard } from "./_components/posting-rules-card";
import { BooksFigures, BooksVsRecords, RecordsFigures } from "./_components/summary-figures";

function LoanAccountingContent() {
  const [asOf, setAsOf] = useState(todayISO());
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const branchId = branchParam(branch);

  const fetcher = useCallback(
    () => accountingService.loanAccountingSummary(asOf, branchId),
    [asOf, branchId],
  );
  const summary = useAccountingResource<LoanAccountingSummary>(fetcher);

  return (
    <div className="space-y-6">
      <AccountingPageHeader
        title="Loan Accounting"
        description="How the loan portfolio looks from the ledger's side, against the loan records."
      />

      <FilterBar>
        <DateFilter label="As of" value={asOf} onChange={setAsOf} />
        <BranchFilter value={branch} onChange={setBranch} />
      </FilterBar>

      <DataState
        resource={summary}
        summary="Loans receivable in the books and on the loan records, the receivable aging, and how far the two agree."
        endpoints={["GET /accounting/loan-accounting/summary"]}
      >
        {(data) => (
          <div className="space-y-6">
            <BooksFigures summary={data} />
            <RecordsFigures summary={data} />
            <BooksVsRecords summary={data} />
            <AgingTable aging={data.aging} />
          </div>
        )}
      </DataState>

      <LoansByAge asOf={asOf} branchId={branchId} />

      <PostingRulesCard />
    </div>
  );
}

export default function LoanAccountingPage() {
  return (
    <RouteGuard permission="accounting:view" pageName="Loan Accounting">
      <LoanAccountingContent />
    </RouteGuard>
  );
}
