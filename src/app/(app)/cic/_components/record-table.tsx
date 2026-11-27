"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollBox } from "@/components/common/page-fill";
import type { CicRecordIssueCount } from "@/lib/cic/records";

export interface CicRecordRow {
  key: string;
  /** The number CIC knows it by: subject number or contract number. */
  number: string;
  name: string;
  /** Record type and its name. */
  kind: string;
  detail: string;
  counts: CicRecordIssueCount | undefined;
}

/** Rendering thousands of rows freezes the page; search narrows it. */
const SHOWN = 500;

function Readiness({ counts }: { counts: CicRecordIssueCount | undefined }) {
  if (!counts || (counts.errors === 0 && counts.warnings === 0)) return <Badge variant="outline">Ready</Badge>;
  if (counts.errors > 0) {
    return (
      <Badge variant="destructive">
        {counts.errors} {counts.errors === 1 ? "error" : "errors"}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      {counts.warnings} {counts.warnings === 1 ? "warning" : "warnings"}
    </Badge>
  );
}

export function RecordTable({ rows, numberLabel }: { rows: CicRecordRow[]; numberLabel: string }) {
  const [search, setSearch] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!onlyErrors || (r.counts?.errors ?? 0) > 0) &&
        (!q || r.number.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)),
    );
  }, [rows, search, onlyErrors]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder={`Search name or ${numberLabel.toLowerCase()}`}
          aria-label="Search"
          className="w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />
          With errors only
        </label>
        <span className="text-sm text-muted-foreground">
          {shown.length} of {rows.length}
        </span>
      </div>
      <ScrollBox className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{numberLabel}</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Readiness</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.slice(0, SHOWN).map((r) => (
              <TableRow key={r.key}>
                <TableCell className="font-mono text-xs">{r.number}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.kind}</TableCell>
                <TableCell className="text-muted-foreground">{r.detail}</TableCell>
                <TableCell>
                  <Readiness counts={r.counts} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollBox>
      {shown.length > SHOWN && (
        <p className="shrink-0 text-xs text-muted-foreground">
          Showing the first {SHOWN} of {shown.length}. Search to narrow the list.
        </p>
      )}
    </div>
  );
}
