"use client";

import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/hooks";
import { CicPageHeader } from "../_components/page-header";
import { SubmissionTable } from "../_components/submission-table";
import { CIC_SUBMISSION_ENDPOINTS, useCicSubmissions } from "../_hooks/use-cic-submissions";
import { CicGuard } from "../_components/cic-guard";

function CicSubmissionsContent() {
  const resource = useCicSubmissions();
  const { can } = usePermission();
  return (
    <PageFill>
      <CicPageHeader
        title="Submission History"
        description="Every file generated for CIC, its encryption, submission and CIC's answer."
        actions={
          can("cic:prepare") && (
            <Button nativeButton={false} render={<Link href="/cic/generate" />}>
              Generate Report
            </Button>
          )
        }
      />
      <DataState
        resource={resource}
        summary="Every Credit Submission Data File generated, with its status at CIC."
        endpoints={CIC_SUBMISSION_ENDPOINTS}
        isEmpty={(d) => d.rows.length === 0}
        emptyMessage="No file has been generated yet."
      >
        {(d) => (
          <>
            {d.truncated && (
              <IncompleteListNotice
                shown={d.rows.length}
                total={d.total}
                noun="submissions"
                consequence="The oldest submissions are missing from this list."
              />
            )}
            <ScrollBox className="rounded-lg border">
              <SubmissionTable submissions={d.rows} />
            </ScrollBox>
          </>
        )}
      </DataState>
    </PageFill>
  );
}

export default function CicSubmissionsPage() {
  return (
    <CicGuard permission="cic:view" pageName="CIC Submission History">
      <CicSubmissionsContent />
    </CicGuard>
  );
}
