"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { ScrollBox } from "@/components/common/page-fill";
import { TablePagination } from "@/components/common/table-pagination";
import { AssessmentBadge, ToneBadge } from "@/components/loan-origination/badges";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource, usePermission } from "@/hooks";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { emptyArt, filtersActive } from "@/lib/illustrations";
import { ASSESSMENT_SHORT_LABELS } from "@/lib/loan-origination";
import { FIT_CLASSES } from "@/lib/page-fill";
import { cn } from "@/lib/utils";
import { loanOriginationService, type AssessmentListFilters } from "@/services/loan-origination.service";
import type { Assessment, AssessmentResult } from "@/types/loan-origination";
import { AssessmentPdfButton } from "../_components/assessment-actions";
import { AssessmentReport } from "../_components/assessment-report";
import { StatusTabs } from "../_components/status-tabs";
import { dtiText, figureText } from "../_lib/assessment-view";
import { termUnitOf } from "../_lib/term";
import { useLoanProducts } from "../../reminders/_hooks/use-loan-products";

const PER_PAGE_OPTIONS = [20, 50, 100] as const;
const RESULTS = Object.keys(ASSESSMENT_SHORT_LABELS) as AssessmentResult[];

/**
 * The current assessment of each application in the caller's branches, newest
 * first, with the server's counts by result. Figures read as the server sends
 * them, withheld ones included.
 */
export default function AssessmentsPage() {
  const [filters, setFilters] = useState<AssessmentListFilters>({ page: 1, per_page: 20 });
  const fetcher = useCallback(() => loanOriginationService.listAssessments(filters), [filters]);
  const list = useApiResource(fetcher);
  const [open, setOpen] = useState<Assessment | null>(null);
  // A term is a number in its loan product's unit; listing products needs loans:view.
  const { products } = useLoanProducts(usePermission().can("loans:view"));

  return (
    <div className={cn(FIT_CLASSES.section, "gap-3")}>
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <StatusTabs
          value={filters.result}
          statuses={RESULTS}
          labels={ASSESSMENT_SHORT_LABELS}
          stats={list.data?.meta.stats}
          onChange={(result) => setFilters((f) => ({ ...f, result, page: 1 }))}
        />
      </div>
      <DataState
        resource={list}
        summary="Each application's affordability assessment, with its ratios and flags, will be listed here once online applications are connected."
        endpoints={["GET /loan-origination/assessments"]}
        isEmpty={(res) => res.data.length === 0}
        emptyMessage="No assessments match these filters."
        emptyIllustration={emptyArt("emptyLoans", filtersActive(filters))}
      >
        {(res) => (
          <div className={cn(FIT_CLASSES.section, "gap-3")}>
            <div className={cn("rounded-xl border bg-card", FIT_CLASSES.section)}>
              <ScrollBox>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application</TableHead>
                      <TableHead>Loan product</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Debt-to-income</TableHead>
                      <TableHead className="text-right">Remaining income</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Assessed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {res.data.map((a) => (
                      <TableRow key={a.id} className="cursor-pointer" onClick={() => setOpen(a)}>
                        <TableCell className="min-w-40">
                          <button
                            type="button"
                            onClick={() => setOpen(a)}
                            className="rounded-sm text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
                          >
                            {a.applicant_name}
                            <span className="sr-only">: view assessment</span>
                          </button>
                          <span className="block text-xs text-muted-foreground">{a.reference_number ?? `Draft #${a.application_id}`}</span>
                        </TableCell>
                        <TableCell>{a.loan_product_name ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.requested_amount === null ? "—" : formatCurrency(a.requested_amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{dtiText(a)}</TableCell>
                        <TableCell className="text-right tabular-nums">{figureText(a, "remaining_income")}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <AssessmentBadge result={a.result} label={a.result_label} />
                          {a.provisional && <ToneBadge tone="warning" className="ml-1">Provisional</ToneBadge>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{a.assessed_at ? formatDateTime(a.assessed_at) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollBox>
            </div>
            <TablePagination
              page={res.meta.current_page}
              perPage={res.meta.per_page}
              total={res.meta.total}
              perPageOptions={PER_PAGE_OPTIONS}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
              onPerPageChange={(per_page) => setFilters((f) => ({ ...f, per_page, page: 1 }))}
            />
          </div>
        )}
      </DataState>

      <Sheet open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{open.applicant_name}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  <AssessmentPdfButton assessment={open} />
                  <Link
                    href={`/loans/origination/applications/${open.application_id}`}
                    className="inline-flex items-center text-sm font-medium text-brand-orange hover:underline"
                  >
                    Open the application
                  </Link>
                </div>
                <AssessmentReport assessment={open} termUnit={termUnitOf(products, open.loan_product_id)} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
