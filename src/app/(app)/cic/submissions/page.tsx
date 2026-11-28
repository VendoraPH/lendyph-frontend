"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { FillSection, PageFill, ScrollBox } from "@/components/common/page-fill";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { usePermission } from "@/hooks";
import { cicService } from "@/services";
import type { CicSubmissionStatus } from "@/types/cic";
import { CicPageHeader } from "../_components/page-header";
import { CicPager } from "../_components/cic-pager";
import { SubmissionTable } from "../_components/submission-table";
import { CIC_PER_PAGE_OPTIONS, usePagedResource } from "../_hooks/use-paged-resource";
import { CicGuard } from "../_components/cic-guard";

const STATUSES: { value: CicSubmissionStatus; label: string }[] = [
  { value: "generated", label: "Generated" },
  { value: "encrypted", label: "Encrypted" },
  { value: "submitted", label: "Submitted to CIC" },
  { value: "accepted", label: "Accepted by CIC" },
  { value: "rejected", label: "Rejected by CIC" },
];

function CicSubmissionsContent() {
  const { can } = usePermission();
  const [status, setStatus] = useState<CicSubmissionStatus | "">("");
  const load = useCallback(
    (page: number, perPage: number) => cicService.submissionsPage({ status: status || undefined, page, per_page: perPage }),
    [status],
  );
  const { resource, pager } = usePagedResource(load, CIC_PER_PAGE_OPTIONS);

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
      <div className="flex shrink-0 items-center gap-2">
        <Label htmlFor="cic-submission-status" className="text-sm">
          Status
        </Label>
        <NativeSelect
          id="cic-submission-status"
          value={status}
          onChange={(e) => setStatus(STATUSES.find((s) => s.value === e.target.value)?.value ?? "")}
        >
          <NativeSelectOption value="">Every status</NativeSelectOption>
          {STATUSES.map((s) => (
            <NativeSelectOption key={s.value} value={s.value}>
              {s.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <FillSection>
        <DataState
          resource={resource}
          summary="Every Credit Submission Data File generated, with its status at CIC."
          endpoints={["GET /cic/submissions"]}
          isEmpty={(d) => d.data.length === 0}
          emptyMessage={status ? "No file has this status." : "No file has been generated yet."}
        >
          {(d) => (
            <>
              <ScrollBox className="rounded-lg border">
                <SubmissionTable
                  submissions={d.data}
                  action={(s) =>
                    s.actions.correct ? (
                      <Button variant="outline" nativeButton={false} render={<Link href={`/cic/corrections/new?corrects=${s.id}`} />}>
                        Prepare Correction
                      </Button>
                    ) : null
                  }
                />
              </ScrollBox>
              <CicPager pager={pager} total={d.meta.total} />
            </>
          )}
        </DataState>
      </FillSection>
    </PageFill>
  );
}

export default function CicSubmissionsPage() {
  return (
    <CicGuard permission="cic:view" pageName="Submission History">
      <CicSubmissionsContent />
    </CicGuard>
  );
}
