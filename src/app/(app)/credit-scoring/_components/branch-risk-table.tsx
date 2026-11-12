import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { RISK_LEVEL_LABELS } from "@/constants/risk-level";
import { RISK_LEVELS, branchRiskCells, branchRiskName } from "@/lib/credit-scoring/risk-level";
import { averageScoreText } from "@/lib/credit-scoring/score-state";
import type { BranchRiskRow } from "@/types/credit-scoring";

const TITLE_ID = "branch-risk-title";

/** Portfolio risk by the member's own branch, as the server counted it. */
export function BranchRiskTable({ rows }: { rows: BranchRiskRow[] }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p id={TITLE_ID} className="mb-3 text-sm font-medium">
          Portfolio Risk by Branch
        </p>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scored members in your branches yet.</p>
        ) : (
          <Table aria-labelledby={TITLE_ID}>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Members Scored</TableHead>
                <TableHead className="text-right">Average Score</TableHead>
                {RISK_LEVELS.map((level) => (
                  <TableHead key={level} className="text-right">
                    {RISK_LEVEL_LABELS[level]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.branch_id ?? "none"}>
                  <TableCell className="font-medium">{branchRiskName(row)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.members_scored}</TableCell>
                  <TableCell className="text-right tabular-nums">{averageScoreText(row.average_score)}</TableCell>
                  {branchRiskCells(row).map((cell) => (
                    <TableCell key={cell.level} className="text-right tabular-nums">
                      {cell.count}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
