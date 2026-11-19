"use client";

import { useCallback, useState } from "react";
import { DataState } from "@/components/common/data-state";
import { ScrollBox } from "@/components/common/page-fill";
import { TablePagination } from "@/components/common/table-pagination";
import { useApiResource } from "@/hooks";
import { emptyArt, filtersActive } from "@/lib/illustrations";
import { APPLICATION_STATUSES, STATUS_LABELS } from "@/lib/loan-origination";
import { FIT_CLASSES } from "@/lib/page-fill";
import { cn } from "@/lib/utils";
import { loanOriginationService } from "@/services";
import type { ApplicationListFilters } from "@/types/loan-origination";
import { ApplicationFilters } from "../_components/application-filters";
import { ApplicationsTable } from "../_components/applications-table";
import { StatusTabs } from "../_components/status-tabs";

const PER_PAGE_OPTIONS = [20, 50, 100] as const;

export default function ApplicationsPage() {
  const [filters, setFilters] = useState<ApplicationListFilters>({ page: 1, per_page: 20 });
  const fetcher = useCallback(() => loanOriginationService.listApplications(filters), [filters]);
  const list = useApiResource(fetcher);

  return (
    <div className={cn(FIT_CLASSES.section, "gap-3")}>
      <ApplicationFilters value={filters} onChange={setFilters} />
      <StatusTabs
        value={filters.status}
        statuses={APPLICATION_STATUSES}
        labels={STATUS_LABELS}
        stats={list.data?.meta.stats}
        onChange={(status) => setFilters((f) => ({ ...f, status, page: 1 }))}
      />
      <DataState
        resource={list}
        summary="Online loan applications, from first draft to conversion, will be listed here once online applications are connected."
        endpoints={["GET /loan-origination/applications"]}
        isEmpty={(res) => res.data.length === 0}
        emptyMessage="No applications match these filters."
        emptyIllustration={emptyArt("emptyLoans", filtersActive(filters))}
      >
        {(res) => (
          <div className={cn(FIT_CLASSES.section, "gap-3")}>
            <div className={cn("rounded-xl border bg-card", FIT_CLASSES.section)}>
              <ScrollBox>
                <ApplicationsTable rows={res.data} />
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
    </div>
  );
}
