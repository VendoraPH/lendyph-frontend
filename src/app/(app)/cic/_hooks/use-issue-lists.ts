"use client";

import { useCallback } from "react";
import { cicService } from "@/services";
import type { CicIssueFilters } from "@/types/cic";

type SeverityOnly = Pick<CicIssueFilters, "severity">;

/** The issue list for one File Reference Date, read and exported from the server. */
export function useDateIssueList(referenceDate: string) {
  const load = useCallback((f: CicIssueFilters) => cicService.issuesPage(referenceDate, f), [referenceDate]);
  const exportCsv = useCallback((f: SeverityOnly) => cicService.exportIssues(referenceDate, f), [referenceDate]);
  return {
    load,
    exportCsv,
    csvName: `cic-validation-${referenceDate}.csv`,
    endpoints: ["GET /cic/issues", "GET /cic/issues/export"],
  };
}

/** The issues one submission was generated with. */
export function useSubmissionIssueList(id: number, filename: string) {
  const load = useCallback((f: CicIssueFilters) => cicService.submissionIssuesPage(id, f), [id]);
  const exportCsv = useCallback((f: SeverityOnly) => cicService.exportSubmissionIssues(id, f), [id]);
  return {
    load,
    exportCsv,
    csvName: `${filename.replace(/\.txt$/, "")}-issues.csv`,
    endpoints: ["GET /cic/submissions/{id}/issues", "GET /cic/submissions/{id}/issues/export"],
  };
}
