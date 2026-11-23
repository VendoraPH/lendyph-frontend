"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useApiResource, usePermission } from "@/hooks";
import { cdaService } from "@/services";
import type { CdaReport } from "@/types/cda";
import { GAP_PERMISSIONS, evidenceDocumentsNeeded, withUploaded, type EvidenceDocument } from "../_lib/screen-gaps";

export interface EvidenceDocuments {
  /** The report the evidence is on: an upload goes to its year, linked to it. */
  report: Pick<CdaReport, "id" | "year" | "report_type" | "part">;
  /** The year's Compliance Documents; null until they load, or when they couldn't. */
  documents: EvidenceDocument[] | null;
  /** The list couldn't be read, so the picker offers none. */
  failed: boolean;
  /** A document uploaded here, as the upload answered it: offered at once. */
  uploaded: (document: EvidenceDocument) => void;
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
  const [added, setAdded] = useState<EvidenceDocument[]>([]);
  const value: EvidenceDocuments = {
    report,
    documents: resource.data ? withUploaded(resource.data.rows, added) : null,
    failed: enabled && !resource.loading && resource.data === null,
    uploaded: (document) => setAdded((list) => [...list, document]),
  };
  return <EvidenceDocumentsContext.Provider value={value}>{children}</EvidenceDocumentsContext.Provider>;
}

/** The report's evidence documents; null outside a report. */
export function useEvidenceDocuments(): EvidenceDocuments | null {
  return useContext(EvidenceDocumentsContext);
}
