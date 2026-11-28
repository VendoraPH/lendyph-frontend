import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CicDataRecordType, CicIssue } from "@/types/cic";
import { CLASSIFICATION_LABELS, RECORD_TYPE_LABELS } from "../_lib/labels";
import { SeverityBadge } from "./severity-badge";

const isDataRecord = (type: CicIssue["record_type"]): type is CicDataRecordType => type !== "HD" && type !== "FT";

/**
 * Issues as the server worded them. The member's name shows only when the
 * server sent it (`borrowers:view`); the server's internal code never shows.
 */
export function IssueTable({
  issues,
  onOpenRecord,
  showRecord = true,
}: {
  issues: CicIssue[];
  onOpenRecord?: (type: CicDataRecordType, key: string) => void;
  showRecord?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Severity</TableHead>
          {showRecord && <TableHead>Record</TableHead>}
          <TableHead>Field</TableHead>
          <TableHead>Problem</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((i, n) => (
          <TableRow key={`${i.record_type}-${i.record_key}-${i.field_id ?? ""}-${n}`}>
            <TableCell>
              <SeverityBadge severity={i.severity} />
            </TableCell>
            {showRecord && (
              <TableCell className="whitespace-normal">
                {isDataRecord(i.record_type) && i.record_key ? (
                  onOpenRecord ? (
                    <Button
                      variant="link"
                      className="h-auto p-0 font-mono text-xs"
                      onClick={() => onOpenRecord(i.record_type as CicDataRecordType, i.record_key)}
                    >
                      {i.record_key}
                    </Button>
                  ) : (
                    <span className="font-mono text-xs">{i.record_key}</span>
                  )
                ) : (
                  <span className="font-medium">{RECORD_TYPE_LABELS[i.record_type]}</span>
                )}
                {i.member && <span className="block text-sm">{i.member.name}</span>}
                {isDataRecord(i.record_type) && (
                  <span className="block text-xs text-muted-foreground">{RECORD_TYPE_LABELS[i.record_type]}</span>
                )}
              </TableCell>
            )}
            <TableCell className="whitespace-normal">
              {i.field_id ? (
                <>
                  <span className="font-mono text-xs">{i.field_id}</span> {i.field_name}
                  {i.classification && (
                    <span className="block text-xs text-muted-foreground">{CLASSIFICATION_LABELS[i.classification]}</span>
                  )}
                </>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell className="whitespace-normal">
              {i.message}
              {i.code_label && <span className="block text-xs text-muted-foreground">{i.code_label}</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
