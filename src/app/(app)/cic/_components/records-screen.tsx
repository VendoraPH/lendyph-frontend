"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { FillSection, PageFill, ScrollBox } from "@/components/common/page-fill";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cicService } from "@/services";
import type { CicDataRecordType, CicRecordRow } from "@/types/cic";
import { CONTRACT_RECORD_TYPES, recordTypeLabel, SUBJECT_RECORD_TYPES } from "../_lib/labels";
import { useCicSource } from "../_hooks/use-cic-source";
import { usePagedResource } from "../_hooks/use-paged-resource";
import { CicPageHeader } from "./page-header";
import { CicPager } from "./cic-pager";
import { RecordDetailDialog, type OpenRecord } from "./record-detail-dialog";
import { ReadinessBadge } from "./severity-badge";
import { SourceField } from "./source-field";

function RecordRows({ rows, onOpen }: { rows: CicRecordRow[]; onOpen: (r: OpenRecord) => void }) {
  // The server names the member only for `borrowers:view` holders.
  const withMembers = rows.some((r) => r.member);
  return (
    <ScrollBox className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            {withMembers && <TableHead>Member</TableHead>}
            <TableHead>Readiness</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={`${r.record_type}-${r.record_key}`}>
              <TableCell>
                <Button
                  variant="link"
                  className="h-auto p-0 font-mono text-xs"
                  onClick={() => onOpen({ type: r.record_type, key: r.record_key })}
                >
                  {r.record_key}
                </Button>
              </TableCell>
              {withMembers && <TableCell>{r.member ? r.member.name : "—"}</TableCell>}
              <TableCell>
                <ReadinessBadge errors={r.errors} warnings={r.warnings} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollBox>
  );
}

/**
 * Subject Records (ID, NE) and Contract Records (CI, CN): the server's
 * records, a page at a time, built live or read from a capture.
 */
export function RecordsScreen({ kind }: { kind: "subjects" | "contracts" }) {
  const types = kind === "subjects" ? SUBJECT_RECORD_TYPES : CONTRACT_RECORD_TYPES;
  const [recordType, setRecordType] = useState<CicDataRecordType>(types[0]);
  const [opened, setOpened] = useState<OpenRecord | null>(null);
  const { value, setValue, source, captures } = useCicSource();
  const load = useCallback(
    (page: number) => cicService.recordsPage(source, { record_type: recordType, page }),
    [source, recordType],
  );
  const { resource, pager } = usePagedResource(load);
  const isSubjects = kind === "subjects";

  return (
    <PageFill>
      <CicPageHeader
        title={isSubjects ? "Subject Records" : "Contract Records"}
        description={
          isSubjects
            ? "Each member CIC receives (ID records) and each negative event (NE), and what holds it back."
            : "Each loan as a CIC contract, installment (CI) or non-installment (CN), and what holds it back."
        }
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/cic/issues" />}>
            See Every Issue
          </Button>
        }
      />
      <div className="flex shrink-0 flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="cic-record-type" className="text-sm">
            Record
          </Label>
          <NativeSelect
            id="cic-record-type"
            value={recordType}
            onChange={(e) => setRecordType(types.find((t) => t === e.target.value) ?? types[0])}
          >
            {types.map((t) => (
              <NativeSelectOption key={t} value={t}>
                {recordTypeLabel(t)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <SourceField value={value} onChange={setValue} captures={captures} />
      </div>
      <FillSection>
        <DataState
          resource={resource}
          summary="Every record CIC receives, checked field by field on the server."
          endpoints={["GET /cic/records"]}
          isEmpty={(d) => d.data.length === 0}
          emptyMessage={isSubjects ? "No subject to report from this source." : "No loan to report from this source."}
        >
          {(d) => (
            <>
              <RecordRows rows={d.data} onOpen={setOpened} />
              <CicPager pager={pager} total={d.meta.total} />
            </>
          )}
        </DataState>
      </FillSection>
      <RecordDetailDialog open={opened} source={source} onClose={() => setOpened(null)} />
    </PageFill>
  );
}
