"use client";

import { useCallback, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { httpStatusOf } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { labelOf } from "../_lib/labels";
import { signedUrl } from "../_lib/safe-url";
import { ToneBadge } from "./tone-badge";
import type { CdaExport, CdaExportFormat } from "@/types/cda";

const FORMAT_LABELS: Record<CdaExportFormat, string> = { pdf: "PDF", xlsx: "Excel" };

/** The server allows five exports a minute per user, and answers more with 429. */
export const EXPORT_LIMIT_MESSAGE = "Exports are limited to five a minute. Wait a minute, then try again.";

/** Words for a failed export: the limit in words, else the server's message. */
export function exportErrorMessage(status: number | null): string | null {
  return status === 429 ? EXPORT_LIMIT_MESSAGE : null;
}

function ExportRow({ item }: { item: CdaExport }) {
  const url = signedUrl(item.url);
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
      <div className="min-w-0 space-y-0.5">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {labelOf(FORMAT_LABELS, item.format)} · version {item.version}
          {item.is_draft && <ToneBadge tone="warning" label="DRAFT" />}
        </p>
        <p className="text-xs text-muted-foreground">
          {item.generated_by?.name ?? "System"} · {formatDateTime(item.generated_at)}
          {item.snapshot_version !== null && ` · from finalized version ${item.snapshot_version}`}
        </p>
      </div>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
          Open <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      )}
    </li>
  );
}

/**
 * Exports are made by the server (PDF or Excel), marked DRAFT until the report
 * is finalized, audited, and opened through a signed link that lasts 30
 * minutes. Replaces #510's browser exporters.
 */
export function ExportPanel({ reportId }: { reportId: number }) {
  const resource = useApiResource(useCallback(() => cdaService.listExports(reportId), [reportId]));
  const [busy, setBusy] = useState<CdaExportFormat | null>(null);

  function create(format: CdaExportFormat) {
    setBusy(format);
    cdaService
      .createExport(reportId, format)
      .then((made) => {
        notifySuccess(made.is_draft ? `${FORMAT_LABELS[format]} ready, marked DRAFT` : `${FORMAT_LABELS[format]} ready`);
        const url = signedUrl(made.url);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
        resource.refetch();
      })
      .catch((err: unknown) => {
        const limit = exportErrorMessage(httpStatusOf(err));
        if (limit) notifyError(null, limit);
        else notifyError(err, `Could not export the ${FORMAT_LABELS[format]}`);
      })
      .finally(() => setBusy(null));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Exports</CardTitle>
        <CardDescription>Made by the server. A link opens for 30 minutes; export again for a new one.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FORMAT_LABELS) as CdaExportFormat[]).map((format) => (
            <PermissionButton
              key={format}
              permission="cda:export"
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => create(format)}
            >
              <Download className="mr-1 h-4 w-4" />
              {busy === format ? "Exporting…" : FORMAT_LABELS[format]}
            </PermissionButton>
          ))}
        </div>
        <DataState
          resource={resource}
          endpoints={[`GET ${API_ENDPOINTS.CDA.REPORT_EXPORTS(reportId)}`]}
          summary="This report's exports"
          isEmpty={(d) => d.length === 0}
          emptyMessage="No exports yet."
        >
          {(items) => (
            <ul className="divide-y">
              {items.map((item) => (
                <ExportRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}
