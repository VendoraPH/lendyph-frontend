import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { countOrDash, currencyOrDash } from "@/lib/report-format";
import type { SavingsBreakdown } from "@/types/savings-insight";

const MONEY_COLUMNS = [
  ["closing_balance", "Savings"],
  ["time_deposits", "Time Deposits"],
  ["total_deposits", "Total"],
  ["deposits", "Deposits"],
  ["withdrawals", "Withdrawals"],
] as const;

/**
 * The deposit summary's rows and totals, by product or by branch. The totals
 * row is the server's, worked out over the whole filter.
 */
export function BreakdownTable({
  title,
  groupLabel,
  breakdown,
}: {
  title: string;
  groupLabel: string;
  breakdown: SavingsBreakdown | null | undefined;
}) {
  const rows = breakdown?.rows ?? [];
  const totals = breakdown?.totals;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nothing to show for this selection.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{groupLabel}</TableHead>
                  <TableHead scope="col" className="text-right">
                    Open Accounts
                  </TableHead>
                  {MONEY_COLUMNS.map(([key, label]) => (
                    <TableHead key={key} scope="col" className="text-right">
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.group_id ?? "none"}-${row.group_name}`}>
                    <TableCell className="text-sm">{row.group_name}</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {countOrDash(row.open_accounts)}
                    </TableCell>
                    {MONEY_COLUMNS.map(([key]) => (
                      <TableCell key={key} className="text-right font-mono text-sm tabular-nums">
                        {currencyOrDash(row[key])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              {totals && (
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-medium">Total</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {countOrDash(totals.open_accounts)}
                    </TableCell>
                    {MONEY_COLUMNS.map(([key]) => (
                      <TableCell key={key} className="text-right font-mono text-sm font-medium tabular-nums">
                        {currencyOrDash(totals[key])}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
