"use client";

import { useCallback } from "react";
import { DataState } from "@/components/common/data-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { formatDateTime } from "@/lib/format";
import { cicService } from "@/services";

/** Every CIC key that was replaced or removed, who did it and why. */
export function KeyHistory({ version }: { version: number }) {
  // `version` bumps after a replace or remove, so the list reloads.
  const fetcher = useCallback(() => {
    void version;
    return cicService.getPublicKeyHistory();
  }, [version]);
  const history = useApiResource(fetcher);

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">Key History</h3>
      <DataState
        resource={history}
        summary="Keys replaced or removed, with the reason given."
        endpoints={["GET /cic/settings/public-key/history"]}
        isEmpty={(rows) => rows.length === 0}
        emptyMessage="No key has been replaced or removed."
      >
        {(rows) => (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fingerprint</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Retired</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="max-w-48 break-all whitespace-normal font-mono text-xs">{h.fingerprint}</TableCell>
                    <TableCell className="whitespace-normal">
                      {formatDateTime(h.uploaded_at)}
                      {h.uploaded_by ? ` by ${h.uploaded_by}` : ""}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {h.retired_at ? formatDateTime(h.retired_at) : "—"}
                      {h.retired_by ? ` by ${h.retired_by}` : ""}
                    </TableCell>
                    <TableCell className="whitespace-normal">{h.retired_reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DataState>
    </section>
  );
}
