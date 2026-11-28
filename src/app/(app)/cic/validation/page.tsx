"use client";

import { useCallback } from "react";
import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { PageFill } from "@/components/common/page-fill";
import { useApiResource, usePermission } from "@/hooks";
import { todayISO } from "@/lib/format";
import { cicService } from "@/services";
import { Button } from "@/components/ui/button";
import type { CicReadiness } from "@/types/cic";
import { CicPageHeader } from "../_components/page-header";
import { IssueList } from "../_components/issue-list";
import { IssueSummary } from "../_components/issue-summary";
import { ReferenceDateField } from "../_components/reference-date-field";
import { useReferenceDate } from "../_components/reference-date";
import { useDateIssueList } from "../_hooks/use-issue-lists";
import { CicGuard } from "../_components/cic-guard";

function CicValidationContent() {
  const [referenceDate, setReferenceDate] = useReferenceDate();
  const fetcher = useCallback(() => cicService.getReadiness(referenceDate), [referenceDate]);
  const readiness = useApiResource<CicReadiness>(fetcher);
  const issues = useDateIssueList(referenceDate);
  const { can } = usePermission();
  const blocking = readiness.data ? readiness.data.issue_counts.errors > 0 : true;

  return (
    <PageFill>
      <CicPageHeader
        title="Validation"
        description="Every field CIC would refuse, checked by Lendy against the 2016 CSDF layouts before a file is generated."
        actions={
          <>
            <ReferenceDateField value={referenceDate} onChange={setReferenceDate} max={todayISO()} />
            {can("cic:prepare") && (
              <Button
                disabled={blocking}
                nativeButton={false}
                render={<Link href={`/cic/generate?date=${referenceDate}`} />}
              >
                Generate Report
              </Button>
            )}
          </>
        }
      />
      <DataState resource={readiness} summary="How many problems the file has, by severity." endpoints={["GET /cic/readiness"]}>
        {(r) => (
          <>
            <IssueSummary counts={r.issue_counts} recordCount={r.subjects.total + r.contracts.total} />
            <IssueList key={referenceDate} {...issues} />
          </>
        )}
      </DataState>
    </PageFill>
  );
}

export default function CicValidationPage() {
  return (
    <CicGuard permission="cic:view" pageName="CIC Validation">
      <CicValidationContent />
    </CicGuard>
  );
}
