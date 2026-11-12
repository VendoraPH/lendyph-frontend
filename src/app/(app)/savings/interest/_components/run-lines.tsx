import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatRate } from "@/lib/format";
import type { InterestRunLine } from "@/types";
import { runLineTierLines, skipReasonText } from "../_lib/run-rules";

/**
 * Per-account figures with the inputs behind them (days, average daily
 * balance, rate and, on a tiered product, each tier the balance used with
 * its days; tax rate), so a checker can review any line. All server figures.
 */
export function RunLines({ lines }: { lines: readonly InterestRunLine[] }) {
  if (lines.length === 0) {
    return (
      <p className="rounded-lg border py-8 text-center text-sm text-muted-foreground">
        No savings accounts fall in this period.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account no.</TableHead>
            <TableHead>Member</TableHead>
            <TableHead className="text-right">Days</TableHead>
            <TableHead className="text-right">Avg. daily balance</TableHead>
            <TableHead className="text-right">Rate</TableHead>
            <TableHead className="text-right">Gross interest</TableHead>
            <TableHead className="text-right">Tax rate</TableHead>
            <TableHead className="text-right">Withholding tax</TableHead>
            <TableHead className="text-right">Net interest</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => {
            const skipped = skipReasonText(line);
            const tiers = runLineTierLines(line);
            return (
              <TableRow key={line.account_id}>
                <TableCell className="font-medium">
                  <Link href={`/savings/accounts/${line.account_id}`} className="underline-offset-2 hover:underline">
                    {line.account_number ?? "—"}
                  </Link>
                </TableCell>
                <TableCell>{line.borrower_name ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{line.days}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(line.average_daily_balance)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRate(line.rate)}%
                  {tiers.length > 0 && (
                    <ul className="mt-0.5 space-y-0.5 text-xs font-normal whitespace-nowrap text-muted-foreground">
                      {tiers.map((tier) => (
                        <li key={tier}>{tier}</li>
                      ))}
                    </ul>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(line.gross_interest)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatRate(line.tax_rate)}%</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(line.withholding_tax)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(line.net_interest)}
                  {skipped && <span className="block text-xs font-normal text-muted-foreground">{skipped}</span>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
