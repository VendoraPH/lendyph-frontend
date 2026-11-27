"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollBox } from "@/components/common/page-fill";
import { csvBlob, toCsv } from "@/lib/csv";
import { saveBlob } from "@/lib/save-blob";
import type { CicIssue, CicSeverity } from "@/lib/cic/types";

/** Rendering thousands of rows freezes the page; the CSV holds them all. */
const SHOWN = 500;

const SEVERITY_LABEL: Record<CicSeverity, string> = { error: "Error", warning: "Warning", info: "Info" };
const SEVERITY_VARIANT: Record<CicSeverity, "destructive" | "secondary" | "outline"> = {
  error: "destructive",
  warning: "secondary",
  info: "outline",
};

type Filter = CicSeverity | "problems" | "all";

export function IssueList({ issues, csvName }: { issues: readonly CicIssue[]; csvName: string }) {
  const [filter, setFilter] = useState<Filter>("problems");
  const rows = useMemo(
    () =>
      issues.filter((i) =>
        filter === "all" ? true : filter === "problems" ? i.severity !== "info" : i.severity === filter,
      ),
    [issues, filter],
  );

  function downloadCsv() {
    const header = ["Severity", "Record", "Record Type", "Field", "Field Name", "Code", "Message"];
    const body = rows.map((i) => [
      SEVERITY_LABEL[i.severity],
      i.recordLabel ?? "",
      i.recordType,
      i.fieldId ?? "",
      i.fieldName ?? "",
      i.code,
      i.message,
    ]);
    saveBlob(csvBlob(toCsv([header, ...body])), csvName);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <NativeSelect
          aria-label="Show"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
        >
          <NativeSelectOption value="problems">Errors and warnings</NativeSelectOption>
          <NativeSelectOption value="error">Errors only</NativeSelectOption>
          <NativeSelectOption value="warning">Warnings only</NativeSelectOption>
          <NativeSelectOption value="info">Information</NativeSelectOption>
          <NativeSelectOption value="all">Everything</NativeSelectOption>
        </NativeSelect>
        <Button variant="outline" size="sm" onClick={downloadCsv} disabled={rows.length === 0}>
          <Download className="size-4" /> Download CSV
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nothing to show.</p>
      ) : (
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
              {rows.slice(0, SHOWN).map((i, n) => (
                <TableRow key={n}>
                  <TableCell>
                    <Badge variant={SEVERITY_VARIANT[i.severity]}>{SEVERITY_LABEL[i.severity]}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <span className="font-medium">{i.recordLabel ?? (i.recordType === "HD" ? "File header" : "File")}</span>
                    <span className="ml-1 text-xs text-muted-foreground">{i.recordType}</span>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {i.fieldId ? (
                      <>
                        <span className="font-mono text-xs">{i.fieldId}</span> {i.fieldName}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal">{i.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollBox>
      )}
      {rows.length > SHOWN && (
        <p className="shrink-0 text-xs text-muted-foreground">
          Showing the first {SHOWN} of {rows.length}. Download the CSV for all of them.
        </p>
      )}
    </div>
  );
}
