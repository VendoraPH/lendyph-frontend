"use client";

import { useCallback, useState } from "react";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { useCdaYear } from "./use-cda-year";
import type { CdaReport, CdaReportType } from "@/types/cda";

/**
 * One CDA report for the selected year. A save or a workflow step returns the
 * whole report, so the reply replaces what is shown without a refetch; the
 * replacement is dropped as soon as the year changes or a refetch lands.
 */
export function useCdaReport(type: CdaReportType) {
  const year = useCdaYear();
  const fetcher = useCallback(() => cdaService.getReport(year, type), [year, type]);
  const resource = useApiResource(fetcher);
  const [override, setOverride] = useState<{ source: CdaReport | null; report: CdaReport } | null>(null);

  // An override only holds while the fetched report it replaced is still the
  // current one and belongs to this year.
  const fresh = override && override.source === resource.data && override.report.year === year;
  const report = fresh ? override.report : resource.data;

  const replace = useCallback(
    (next: CdaReport) => setOverride({ source: resource.data, report: next }),
    [resource.data],
  );

  return { year, resource: { ...resource, data: report }, replace };
}
