"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollBox } from "@/components/common/page-fill";
import type { CicRecordSummary } from "@/types/cic";

const RECORD_NAMES: Record<CicRecordSummary["record_type"], string> = {
  ID: "Individual",
  BD: "Business",
  CI: "Installment",
  CN: "Non-installment",
};

function Readiness({ r }: { r: CicRecordSummary }) {
  if (r.error_count > 0) {
    return (
      <Badge variant="destructive">
        {r.error_count} {r.error_count === 1 ? "error" : "errors"}
      </Badge>
    );
  }
  if (r.warning_count > 0) {
    return (
      <Badge variant="secondary">
        {r.warning_count} {r.warning_count === 1 ? "warning" : "warnings"}
      </Badge>
    );
  }
  return <Badge variant="outline">Ready</Badge>;
}

/** The search box and the errors-only switch; the server applies both. */
export function RecordFilters({
  numberLabel,
  withErrors,
  onSearch,
  onWithErrors,
}: {
  numberLabel: string;
  withErrors: boolean;
  onSearch: (search: string) => void;
  onWithErrors: (on: boolean) => void;
}) {
  const [typed, setTyped] = useState("");
  return (
    <form
      className="flex shrink-0 flex-wrap items-center gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(typed.trim());
      }}
    >
      <Input
        type="search"
        placeholder={`Search ${numberLabel.toLowerCase()} and press Enter`}
        aria-label="Search"
        className="w-72"
        value={typed}
        onChange={(e) => {
          setTyped(e.target.value);
          // Clearing the box shows everything again without another Enter.
          if (e.target.value === "") onSearch("");
        }}
      />
      <Label className="flex items-center gap-2 text-sm font-normal">
        <Checkbox checked={withErrors} onCheckedChange={(on) => onWithErrors(on === true)} />
        With errors only
      </Label>
    </form>
  );
}

/** One page of records: what staff know each by, its masked name and its problems. */
export function RecordTable({ rows, numberLabel }: { rows: CicRecordSummary[]; numberLabel: string }) {
  return (
    <ScrollBox className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{numberLabel}</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Record</TableHead>
            <TableHead>Readiness</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">{r.number}</TableCell>
              <TableCell>{r.label}</TableCell>
              <TableCell>
                {r.record_type} · {RECORD_NAMES[r.record_type]}
                {r.contract_phase && <span className="ml-1 text-muted-foreground">· phase {r.contract_phase}</span>}
              </TableCell>
              <TableCell>
                <Readiness r={r} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollBox>
  );
}
