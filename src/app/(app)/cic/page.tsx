"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { useApiResource, usePermission } from "@/hooks";
import { cicService } from "@/services";
import { todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { CicPageHeader } from "./_components/page-header";
import { ReadinessBody } from "./_components/readiness-body";
import { ReferenceDateField } from "./_components/reference-date-field";
import { StatusCard } from "./_components/status-card";
import { CicGuard } from "./_components/cic-guard";

function CicDashboardContent() {
  const [referenceDate, setReferenceDate] = useState(todayISO);
  const { can } = usePermission();
  const status = useApiResource(cicService.getStatus);
  const fetcher = useCallback(() => cicService.getReadiness(referenceDate), [referenceDate]);
  const readiness = useApiResource(fetcher);

  return (
    <PageFill>
      <CicPageHeader
        title="Data Readiness"
        description="How ready Lendy's members and loans are to report to the Credit Information Corporation, built live by the server."
        actions={
          <>
            <ReferenceDateField value={referenceDate} onChange={setReferenceDate} />
            <Button variant="outline" nativeButton={false} render={<Link href="/cic/issues" />}>
              Review Issues
            </Button>
            {can("cic:prepare") && (
              <Button nativeButton={false} render={<Link href="/cic/generate" />}>
                Generate Report
              </Button>
            )}
          </>
        }
      />
      <ScrollBox className="space-y-6 p-px">
        <DataState resource={status} summary="Whether CIC reporting is set up to make a file." endpoints={["GET /cic/status"]}>
          {(s) => <StatusCard status={s} />}
        </DataState>
        <DataState
          resource={readiness}
          summary="How many records are ready to report to CIC as of the date, and what holds the rest back."
          endpoints={["GET /cic/readiness"]}
        >
          {(data) => <ReadinessBody data={data} />}
        </DataState>
      </ScrollBox>
    </PageFill>
  );
}

export default function CicDashboardPage() {
  return (
    <CicGuard permission="cic:view" pageName="Data Readiness">
      <CicDashboardContent />
    </CicGuard>
  );
}
