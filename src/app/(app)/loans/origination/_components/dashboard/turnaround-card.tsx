import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OriginationTurnaround } from "@/types/loan-origination";
import { turnaroundRows } from "../../_lib/dashboard-view";

/**
 * How long the loans the applications became took to be approved and
 * released, as the server measured them (the executive dashboard's
 * turnaround). It reads null without the permission to view loans.
 */
export function TurnaroundCard({ turnaround }: { turnaround: OriginationTurnaround | null }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Turnaround of the loans from online applications</CardTitle>
      </CardHeader>
      <CardContent>
        {turnaround === null ? (
          <p className="text-sm text-muted-foreground">Needs the permission to view loans.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stretch</TableHead>
                <TableHead className="text-right">Average</TableHead>
                <TableHead className="text-right">Median</TableHead>
                <TableHead className="text-right">Measured</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {turnaroundRows(turnaround).map((row) => (
                <TableRow key={row.key}>
                  <TableCell>
                    {row.label}
                    {row.note && <span className="block text-xs whitespace-normal text-muted-foreground">{row.note}</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.average}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.median}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.loans}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
