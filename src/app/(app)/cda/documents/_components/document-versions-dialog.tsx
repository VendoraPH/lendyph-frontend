"use client";

import { useCallback } from "react";
import { DataState } from "@/components/common/data-state";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDateTime } from "@/lib/format";
import type { CdaDocument } from "@/types/cda";
import { ToneBadge } from "../../_components/tone-badge";
import { signedUrl } from "../../_lib/safe-url";

/**
 * Every version of one document, newest first (carried over from #510 by
 * Augustin). Nothing is overwritten; each version opens by its signed link.
 */
export function DocumentVersionsDialog({
  document,
  onOpenChange,
}: {
  document: CdaDocument | null;
  onOpenChange: (open: boolean) => void;
}) {
  const id = document?.id ?? null;
  const fetcher = useCallback(() => cdaService.listVersions(id ?? 0), [id]);
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
                {versions.map((v) => {
                  const url = signedUrl(v.url);
                  return (
                    <li key={v.id} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0 space-y-0.5">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          Version {v.version}
                          {v.version_label && ` · ${v.version_label}`}
                          {v.is_final && <ToneBadge tone="success" label="Final" />}
                          {v.is_draft && <ToneBadge tone="warning" label="DRAFT" />}
                        </p>
                        <p className="break-all text-xs text-muted-foreground">{v.file_name ?? "File"}</p>
                        <p className="text-xs text-muted-foreground">
                          {v.uploaded_by?.name ?? "System"} · {formatDateTime(v.created_at)}
                        </p>
                        {v.notes && <p className="text-xs italic text-muted-foreground">{v.notes}</p>}
                      </div>
                      {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-medium text-primary hover:underline">
                          Open
                        </a>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </DataState>
        )}
      </DialogContent>
    </Dialog>
  );
}
