import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { SCORE_TYPE_LABELS, labelOf } from "@/lib/credit-scoring/labels";
import { MemberCell } from "./member-cell";
import { ScoreCells } from "./score-cells";
import type { CreditScoreHistoryEntry } from "@/types/credit-scoring";

/** Score history rows as the server sent them, newest first. */
export function ScoreHistoryTable({
  rows,
  showMember = true,
}: {
  rows: CreditScoreHistoryEntry[];
  showMember?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showMember && <TableHead>Member</TableHead>}
          <TableHead>Score</TableHead>
          <TableHead>Risk Level</TableHead>
          <TableHead>Previous</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Scorecard</TableHead>
          <TableHead>Calculated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            {showMember && (
              <TableCell>
                <MemberCell row={row} />
              </TableCell>
            )}
            <ScoreCells row={row} />
            <TableCell className="tabular-nums">{row.previous_score ?? "—"}</TableCell>
            <TableCell>{labelOf(SCORE_TYPE_LABELS, row.score_type)}</TableCell>
            <TableCell>{row.reason}</TableCell>
            <TableCell>v{row.model_version}</TableCell>
            <TableCell>{formatDateTime(row.calculated_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
