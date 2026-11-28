"use client";

import { useCallback, useState } from "react";
import { Download } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { FillSection, ScrollBox } from "@/components/common/page-fill";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { notifyError } from "@/lib/notify";
import { saveBlob } from "@/lib/save-blob";
import { cicService } from "@/services";
import type { CicDataRecordType, CicSeverity, CicSourceFilter } from "@/types/cic";
import { RECORD_TYPE_LABELS } from "../_lib/labels";
import { usePagedResource } from "../_hooks/use-paged-resource";
import { CicPager } from "./cic-pager";
import { IssueTable } from "./issue-table";
import { RecordDetailDialog, type OpenRecord } from "./record-detail-dialog";

const RECORD_TYPES: CicDataRecordType[] = ["ID", "CI", "CN", "NE"];

/** The server's issues for one source, a page at a time, with its counts. */
export function IssueList({ source }: { source: CicSourceFilter }) {
  const [severity, setSeverity] = useState<CicSeverity | "">("");
  const [recordType, setRecordType] = useState<CicDataRecordType | "">("");
  const [opened, setOpened] = useState<OpenRecord | null>(null);
  const load = useCallback(
    (page: number) =>
      cicService.issuesPage(source, {
        severity: severity || undefined,
        record_type: recordType || undefined,
        page,
      }),
    [source, severity, recordType],
  );
  const { resource, pager } = usePagedResource(load);
  const filtered = severity !== "" || recordType !== "";
  const [exporting, setExporting] = useState(false);

  /** The server builds and audits the CSV for the same filters; a 429 reads in its words. */
  const exportCsv = () => {
    setExporting(true);
    cicService
      .exportIssues(source, { severity: severity || undefined, record_type: recordType || undefined })
      .then((file) => saveBlob(file.blob, file.filename ?? "cic-issues.csv"))
      .catch((err) => notifyError(err, "The issues could not be exported."))
      .then(() => setExporting(false));
  };

  return (
    <FillSection className="gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="cic-issue-severity" className="text-sm">
            Show
          </Label>
          <NativeSelect
            id="cic-issue-severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value === "error" || e.target.value === "warning" ? e.target.value : "")}
          >
            <NativeSelectOption value="">Errors and warnings</NativeSelectOption>
            <NativeSelectOption value="error">Errors only</NativeSelectOption>
            <NativeSelectOption value="warning">Warnings only</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="cic-issue-record" className="text-sm">
            Record
          </Label>
          <NativeSelect
            id="cic-issue-record"
            value={recordType}
            onChange={(e) => setRecordType(RECORD_TYPES.find((t) => t === e.target.value) ?? "")}
          >
            <NativeSelectOption value="">Every record</NativeSelectOption>
            {RECORD_TYPES.map((t) => (
              <NativeSelectOption key={t} value={t}>
                {t} · {RECORD_TYPE_LABELS[t]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button
          variant="outline"
          disabled={exporting || (resource.data?.meta.total ?? 0) === 0}
          onClick={exportCsv}
        >
          <Download className="size-4" /> {exporting ? "Exporting…" : "Export CSV"}
        </Button>
        {resource.data && (
          <p className="text-sm text-muted-foreground">
            {resource.data.meta.errors} {resource.data.meta.errors === 1 ? "error" : "errors"} ·{" "}
            {resource.data.meta.warnings} {resource.data.meta.warnings === 1 ? "warning" : "warnings"}
          </p>
        )}
      </div>
      <DataState
        resource={resource}
        summary="Every problem the server found, record by record."
        endpoints={["GET /cic/issues"]}
        isEmpty={(d) => d.data.length === 0}
        emptyMessage={filtered ? "No issue matches." : "No issues: every record is ready."}
        emptyIllustration={filtered ? "noResults" : "empty"}
      >
        {(d) => (
          <>
            <ScrollBox className="rounded-lg border">
              <IssueTable issues={d.data} onOpenRecord={(type, key) => setOpened({ type, key })} />
            </ScrollBox>
            <CicPager pager={pager} total={d.meta.total} />
          </>
        )}
      </DataState>
      <RecordDetailDialog open={opened} source={source} onClose={() => setOpened(null)} />
    </FillSection>
  );
}
