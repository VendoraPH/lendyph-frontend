import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCount, formatCountOf } from "@/lib/report-format";
import type { CicValidationSummary } from "@/types/cic";
import { recordTypeLabel } from "../_lib/labels";
import { SeverityBadge } from "./severity-badge";

/** The server's validation of a capture: counts and the fields with the most issues. */
export function ValidationSummary({ validation }: { validation: CicValidationSummary }) {
  return (
    <div className="space-y-2">
      <p className="text-sm">
        {formatCountOf(validation.errors, "error")} · {formatCountOf(validation.warnings, "warning")}
      </p>
      {validation.top_issues.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Severity</TableHead>
                <TableHead>Field</TableHead>
                <TableHead className="text-right">Records</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {validation.top_issues.map((i) => (
                <TableRow key={`${i.record_type}-${i.field_id}-${i.code}`}>
                  <TableCell>
                    <SeverityBadge severity={i.severity} />
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <span className="font-mono text-xs">{i.field_id ?? "—"}</span> {i.field_name}
                    <span className="block text-xs text-muted-foreground">{recordTypeLabel(i.record_type)}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(i.count)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
