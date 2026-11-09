import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { Aging } from "@/types";
import {
  bucketLabel,
  centavosOrDash,
  shareBarValue,
  sharePercentLabel,
} from "../_lib/loan-accounting-view";

/** The receivable aging, every figure the server's. */
export function AgingTable({ aging }: { aging: Aging }) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Receivable aging
          </h2>
          <p className="text-xs text-muted-foreground">
            As of {formatDate(aging.as_of)}, by the oldest unpaid instalment. Past due{" "}
            <span className="font-mono">{centavosOrDash(aging.past_due_total)}</span>.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bucket</TableHead>
              <TableHead className="w-24 text-right">Accounts</TableHead>
              <TableHead className="w-40 text-right">Amount</TableHead>
              <TableHead className="w-56">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aging.rows.map((row) => (
              <TableRow key={row.bucket}>
                <TableCell className="text-sm">{bucketLabel(row.bucket)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{row.count}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {centavosOrDash(row.amount)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Progress
                      value={shareBarValue(row.share_percent)}
                      aria-label={`${bucketLabel(row.bucket)} share`}
                      className="h-2 flex-1"
                    />
                    <span className="w-16 text-right font-mono text-xs text-muted-foreground">
                      {sharePercentLabel(row.share_percent)}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {aging.count_total}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {centavosOrDash(aging.total)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
