"use client";

import { useCallback } from "react";
import { DataState } from "@/components/common/data-state";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDateTime } from "@/lib/format";
import type { CdaComplianceDocument } from "@/types/cda";

/** Every uploaded version of one document, newest first. Nothing is overwritten. */
export function DocumentVersionsDialog({
  document,
  onOpenChange,
}: {
  document: CdaComplianceDocument | null;
  onOpenChange: (open: boolean) => void;
}) {
  const id = document?.id ?? null;
  const fetcher = useCallback(() => cdaService.listDocumentVersions(id ?? 0), [id]);
  const resource = useApiResource(fetcher, id !== null);

  return (
    <Dialog open={document !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Versions</DialogTitle>
          <DialogDescription>{document?.title}</DialogDescription>
        </DialogHeader>
        {id !== null && (
          <DataState
            resource={resource}
            endpoints={[`GET ${API_ENDPOINTS.CDA.DOCUMENT_VERSIONS(id)}`]}
            summary="Every version of this document"
            isEmpty={(d) => d.length === 0}
          >
            {(versions) => (
              <ol className="divide-y text-sm">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        v{v.version} · <span className="break-all">{v.file_name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {v.uploaded_by} · {formatDateTime(v.uploaded_at)}
                      </p>
                      {v.notes && <p className="text-xs italic text-muted-foreground">{v.notes}</p>}
                    </div>
                    <a
                      href={v.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-xs font-medium text-primary hover:underline"
                    >
                      Open
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </DataState>
        )}
      </DialogContent>
    </Dialog>
  );
}
