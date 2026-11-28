"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { PageFill } from "@/components/common/page-fill";
import { TablePagination } from "@/components/common/table-pagination";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/format";
import { cicService } from "@/services";
import { CIC_PER_PAGE_OPTIONS, usePagedResource } from "../_hooks/use-paged-resource";
import { CicPageHeader } from "./page-header";
import { RecordFilters, RecordTable } from "./record-table";
import { ReferenceDateField } from "./reference-date-field";
import { useReferenceDate } from "./reference-date";

/**
 * Subject Records and Contract Records: the same screen over a different half
 * of the file. The server pages, searches and masks the list; no record's
 * field values reach the browser.
 */
export function RecordsScreen({ kind }: { kind: "subjects" | "contracts" }) {
  const [referenceDate, setReferenceDate] = useReferenceDate();
  const [search, setSearch] = useState("");
  const [withErrors, setWithErrors] = useState(false);
  const isSubjects = kind === "subjects";
  const numberLabel = isSubjects ? "Subject No" : "Loan No";

  const load = useCallback(
    (page: number, perPage: number) => {
      const filters = {
        reference_date: referenceDate,
        search: search || undefined,
        with_errors: withErrors || undefined,
        page,
        per_page: perPage,
      };
      return isSubjects ? cicService.subjectsPage(filters) : cicService.contractsPage(filters);
    },
    [referenceDate, search, withErrors, isSubjects],
  );
  const { resource, page, perPage, setPage, setPerPage } = usePagedResource(load);
  const filtered = search !== "" || withErrors;

  return (
    <PageFill>
      <CicPageHeader
        title={isSubjects ? "Subject Records" : "Contract Records"}
        description={
          isSubjects
            ? "Each member (ID record) and business (BD record) CIC will receive, and what holds it back."
            : "Each loan as a CIC contract record, installment (CI) or non-installment (CN), and what holds it back."
        }
        actions={
          <>
            <ReferenceDateField value={referenceDate} onChange={setReferenceDate} max={todayISO()} />
            <Button variant="outline" nativeButton={false} render={<Link href="/cic/validation" />}>
              See Every Issue
            </Button>
          </>
        }
      />
      <RecordFilters numberLabel={numberLabel} withErrors={withErrors} onSearch={setSearch} onWithErrors={setWithErrors} />
      <DataState
        resource={resource}
        summary={
          isSubjects
            ? "Every member and business CIC will receive, checked field by field."
            : "Every loan CIC will receive, checked field by field."
        }
        endpoints={[isSubjects ? "GET /cic/subjects" : "GET /cic/contracts"]}
        isEmpty={(d) => d.data.length === 0}
        emptyMessage={
          filtered
            ? "No record matches."
            : isSubjects
              ? "No subject to report as of this date."
              : "No loan to report as of this date."
        }
        emptyIllustration={filtered ? "noResults" : "empty"}
      >
        {(d) => (
          <>
            <RecordTable rows={d.data} numberLabel={numberLabel} />
            <TablePagination
              page={page}
              perPage={perPage}
              total={d.meta.total}
              perPageOptions={CIC_PER_PAGE_OPTIONS}
              onPageChange={setPage}
              onPerPageChange={setPerPage}
            />
          </>
        )}
      </DataState>
    </PageFill>
  );
}
