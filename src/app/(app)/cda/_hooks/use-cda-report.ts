"use client";

import { useCallback, useState } from "react";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import type { CdaReport, CdaReportPart, CdaReportType } from "@/types/cda";

/**
 * One CDA report, found by year and type (and half, for mediation). A save
 * or a workflow step answers with the whole report, which replaces what is
 * shown without a refetch; the replacement holds only while the fetched
 * report it replaced is still current.
 */
export function useCdaReport(year: number, type: CdaReportType, part?: CdaReportPart) {
  const fetcher = useCallback(() => cdaService.reportByType(year, type, part), [year, type, part]);
  const resource = useApiResource(fetcher);
  const [override, setOverride] = useState<{ source: CdaReport | null; report: CdaReport } | null>(null);

  const fresh = override !== null && override.source === resource.data && override.report.year === year;
  const report = fresh ? override.report : resource.data;

  const replace = useCallback((next: CdaReport) => setOverride({ source: resource.data, report: next }), [resource.data]);

  return { resource: { ...resource, data: report }, replace };
}
