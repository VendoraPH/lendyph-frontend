"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useApiResource, usePermission } from "@/hooks";
import { cdaService } from "@/services";
import type { CdaReport } from "@/types/cda";
import { GAP_PERMISSIONS, evidenceDocumentsNeeded, type EvidenceDocument } from "../_lib/screen-gaps";

export interface EvidenceDocuments {
  /** The report the evidence is on: an upload goes to its year, linked to it. */
  report: Pick<CdaReport, "id" | "year" | "report_type" | "part">;
  /** The year's Compliance Documents; null until they load, or when they couldn't. */
  documents: EvidenceDocument[] | null;
  /** The list couldn't be read, so the picker offers none. */
  failed: boolean;
  /** Read the list again (after an upload). */
  reload: () => void;
}

const EvidenceDocumentsContext = createContext<EvidenceDocuments | null>(null);

/**
 * The year's Compliance Documents for a report's evidence: read once for the
 * whole report, as the documents register reads them (cda:view), and only
 * where evidence can link one or already does.
 */
export function EvidenceDocumentsProvider({
  report,
  canEdit,
  children,
}: {
  report: CdaReport;
  /** The report takes edits: its evidence can link a document. */
  canEdit: boolean;
  children: ReactNode;
}) {
  const { can } = usePermission();
  const enabled = can(GAP_PERMISSIONS.evidenceDocuments) && evidenceDocumentsNeeded(report.sections, canEdit);
  const year = report.year;
  const resource = useApiResource(
    useCallback(() => cdaService.listDocuments(year), [year]),
    enabled,
  );
  const value: EvidenceDocuments = {
    report,
    documents: resource.data?.rows ?? null,
    failed: enabled && !resource.loading && resource.data === null,
    reload: resource.refetch,
  };
  return <EvidenceDocumentsContext.Provider value={value}>{children}</EvidenceDocumentsContext.Provider>;
}

/** The report's evidence documents; null outside a report. */
export function useEvidenceDocuments(): EvidenceDocuments | null {
  return useContext(EvidenceDocumentsContext);
}
