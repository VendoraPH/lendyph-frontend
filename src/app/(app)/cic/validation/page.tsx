"use client";

import Link from "next/link";
import { RouteGuard } from "@/components/common/route-guard";
import { DataState } from "@/components/common/data-state";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { PageFill } from "@/components/common/page-fill";
import { usePermission } from "@/hooks";
import { todayISO } from "@/lib/format";
import { summarizeCicIssues } from "@/lib/cic/validate";
import { Button } from "@/components/ui/button";
import { CicPageHeader } from "../_components/page-header";
import { IssueList } from "../_components/issue-list";
import { IssueSummary } from "../_components/issue-summary";
import { ReferenceDateField } from "../_components/reference-date-field";
import { useReferenceDate } from "../_components/reference-date";
import { CIC_RECORD_ENDPOINTS, useCicRecords } from "../_hooks/use-cic-records";

function CicValidationContent() {
  const [referenceDate, setReferenceDate] = useReferenceDate();
  const resource = useCicRecords(referenceDate);
  const { can } = usePermission();
  const blocking = resource.data ? summarizeCicIssues(resource.data.issues).blocking : true;

  return (
    <PageFill>
      <CicPageHeader
        title="Validation"
        description="Every field CIC would refuse, checked against the 2016 CSDF layouts before a file is generated."
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
      <DataState resource={resource} summary="Every problem in the file, record by record." endpoints={CIC_RECORD_ENDPOINTS}>
        {(set) => (
          <>
            {set.truncated && (
              <IncompleteListNotice
                shown={set.inputs.length}
                total={set.total}
                noun="records"
                consequence="Some records were not loaded, so their problems are not listed here."
              />
            )}
            <IssueSummary issues={set.issues} recordCount={set.inputs.length} />
            <IssueList issues={set.issues} csvName={`cic-validation-${referenceDate}.csv`} />
          </>
        )}
      </DataState>
    </PageFill>
  );
}

export default function CicValidationPage() {
  return (
    <RouteGuard permission="cic:view" pageName="CIC Validation">
      <CicValidationContent />
    </RouteGuard>
  );
}
