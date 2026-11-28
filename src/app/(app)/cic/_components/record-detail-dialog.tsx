"use client";

import { useCallback } from "react";
import { DataState } from "@/components/common/data-state";
import { ScrollBox } from "@/components/common/page-fill";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { formatDate } from "@/lib/format";
import { cicService } from "@/services";
import type { CicDataRecordType, CicRecordDetail, CicSourceFilter } from "@/types/cic";
import { CLASSIFICATION_LABELS, recordTypeLabel } from "../_lib/labels";
import { IssueTable } from "./issue-table";
import { ReadinessBadge } from "./severity-badge";

export interface OpenRecord {
  type: CicDataRecordType;
  key: string;
}

function RecordBody({ record }: { record: CicRecordDetail }) {
  // The server sends values only to `borrowers:view` holders.
  const withValues = record.fields.some((f) => "value" in f);
  return (
    <ScrollBox always className="max-h-[65vh] space-y-5 p-px">
      <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Record</dt>
        <dd>{recordTypeLabel(record.record_type)}</dd>
        {record.member && (
          <>
            <dt className="text-muted-foreground">Member</dt>
            <dd>
              {record.member.name} <span className="text-muted-foreground">· {record.member.code}</span>
            </dd>
          </>
        )}
        <dt className="text-muted-foreground">Readiness</dt>
        <dd>
          <ReadinessBadge errors={record.errors} warnings={record.warnings} />
        </dd>
      </dl>
      {record.issues.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Problems</h3>
          <div className="rounded-lg border">
            <IssueTable issues={record.issues} showRecord={false} />
          </div>
        </section>
      )}
      <section className="space-y-2">
        <h3 className="text-sm font-medium">Fields</h3>
        {!withValues && (
          <p className="text-xs text-muted-foreground">
            Field values show only to staff who may see members&apos; details.
          </p>
        )}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Required</TableHead>
                {withValues && <TableHead>Value</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {record.fields.map((f) => (
                <TableRow key={f.field_id}>
                  <TableCell className="whitespace-normal">
                    <span className="font-mono text-xs">{f.field_id}</span> {f.name}
                  </TableCell>
                  <TableCell>{CLASSIFICATION_LABELS[f.classification]}</TableCell>
                  {withValues && (
                    <TableCell className="whitespace-normal break-all font-mono text-xs">
                      {f.value ? f.value : <span className="text-muted-foreground">Empty</span>}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </ScrollBox>
  );
}

function RecordLoader({ open, source }: { open: OpenRecord; source: CicSourceFilter }) {
  const fetcher = useCallback(() => cicService.getRecord(open.type, open.key, source), [open, source]);
  const resource = useApiResource(fetcher);
  return (
    <DataState resource={resource} summary="One CIC record, checked field by field." endpoints={["GET /cic/records/{type}/{key}"]}>
      {(record) => <RecordBody record={record} />}
    </DataState>
  );
}

/** One record's fields and problems, from the server. Mounted only while open. */
export function RecordDetailDialog({
  open,
  source,
  onClose,
}: {
  open: OpenRecord | null;
  source: CicSourceFilter;
  onClose: () => void;
}) {
  return (
    <Dialog open={open !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-mono">{open?.key ?? ""}</DialogTitle>
          <DialogDescription>
            {"capture_id" in source ? "As frozen in the chosen capture." : `Built now, as of ${formatDate(source.reference_date)}.`}
          </DialogDescription>
        </DialogHeader>
        {open && <RecordLoader key={`${open.type}-${open.key}`} open={open} source={source} />}
      </DialogContent>
    </Dialog>
  );
}
