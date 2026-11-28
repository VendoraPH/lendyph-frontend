"use client";

import { useCallback, useState } from "react";
import { Download } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { ScrollBox } from "@/components/common/page-fill";
import { TablePagination } from "@/components/common/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notifyError } from "@/lib/notify";
import { saveBlob } from "@/lib/save-blob";
import type { PaginatedResponse } from "@/types/api";
import type { CicIssue, CicIssueFilters, CicSeverity } from "@/types/cic";
import { CIC_PER_PAGE_OPTIONS, usePagedResource } from "../_hooks/use-paged-resource";

const SEVERITY_LABEL: Record<CicSeverity, string> = { error: "Error", warning: "Warning", info: "Info" };
const SEVERITY_VARIANT: Record<CicSeverity, "destructive" | "secondary" | "outline"> = {
  error: "destructive",
  warning: "secondary",
  info: "outline",
};

type Severity = CicIssueFilters["severity"];

/**
 * The issues the backend found, a page at a time. The CSV is built and
 * audited by the server; the browser only saves it.
 */
export function IssueList({
  load,
  exportCsv,
  csvName,
  endpoints,
}: {
  /** Stable (`useCallback`). */
  load: (filters: CicIssueFilters) => Promise<PaginatedResponse<CicIssue>>;
  exportCsv: (filters: Pick<CicIssueFilters, "severity">) => Promise<Blob>;
  csvName: string;
  endpoints: string[];
}) {
  const [severity, setSeverity] = useState<Severity>("problems");
  const [exporting, setExporting] = useState(false);
  const loadPage = useCallback(
    (page: number, perPage: number) => load({ severity, page, per_page: perPage }),
    [load, severity],
  );
  const { resource, page, perPage, setPage, setPerPage } = usePagedResource(loadPage);
  const total = resource.data?.meta.total ?? 0;

  const download = () => {
    setExporting(true);
    exportCsv({ severity })
      .then((blob) => saveBlob(blob, csvName))
      .catch((err) => notifyError(err, "The issues could not be exported."))
      .then(() => setExporting(false));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <NativeSelect aria-label="Show" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
          <NativeSelectOption value="problems">Errors and warnings</NativeSelectOption>
          <NativeSelectOption value="error">Errors only</NativeSelectOption>
          <NativeSelectOption value="warning">Warnings only</NativeSelectOption>
          <NativeSelectOption value="info">Information</NativeSelectOption>
          <NativeSelectOption value="all">Everything</NativeSelectOption>
        </NativeSelect>
        <Button variant="outline" size="sm" onClick={download} disabled={exporting || total === 0}>
          <Download className="size-4" /> {exporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>
      <DataState
        resource={resource}
        summary="Every problem in the file, record by record."
        endpoints={endpoints}
        isEmpty={(d) => d.data.length === 0}
        emptyMessage="Nothing to show."
      >
        {(d) => (
          <>
            <ScrollBox className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Severity</TableHead>
                    <TableHead>Record</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead>Problem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.data.map((i, n) => (
                    <TableRow key={`${d.meta.current_page}-${n}`}>
                      <TableCell>
                        <Badge variant={SEVERITY_VARIANT[i.severity]}>{SEVERITY_LABEL[i.severity]}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <span className="font-medium">
                          {i.record_label ?? (i.record_type === "HD" ? "File header" : "File")}
                        </span>
                        <span className="ml-1 text-xs text-muted-foreground">{i.record_type}</span>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {i.field_id ? (
                          <>
                            <span className="font-mono text-xs">{i.field_id}</span> {i.field_name}
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {i.message}
                        <span className="block text-xs text-muted-foreground">{i.code_label}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollBox>
            <TablePagination
              page={page}
              perPage={perPage}
              total={d.meta.total}
              perPageOptions={CIC_PER_PAGE_OPTIONS}
              onPageChange={setPage}
              onPerPageChange={setPerPage}
            />
          </>
        )}
      </DataState>
    </div>
  );
}
