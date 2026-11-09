import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { AdjustmentDirection, BranchView } from "../_lib/allowance";

const DIRECTION_STYLES: Record<AdjustmentDirection, string> = {
  provide: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  release: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  none: "border-slate-500/30 bg-slate-500/10 text-slate-700",
};

/** One branch: its buckets, then its required amount, current balance and adjustment. */
export function BranchAllowanceCard({ branch }: { branch: BranchView }) {
  const figures: Array<[string, string]> = [
    ["Required", branch.required],
    ["Current balance", branch.currentBalance],
    ["Adjustment", branch.adjustment],
  ];

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{branch.name}</h2>
          <Badge
            variant="outline"
            className={cn(branch.direction && DIRECTION_STYLES[branch.direction])}
          >
            {branch.adjustment}
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <caption className="sr-only">Allowance by aging bucket for {branch.name}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Bucket</TableHead>
                <TableHead className="text-right">Loans</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Required</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branch.rows.map((row) => (
                <TableRow key={row.bucket}>
                  <TableCell className="text-sm">{row.label}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.loans}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.principal}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.rate}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.required}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">Total</TableCell>
                <TableCell />
                <TableCell className="text-right font-mono font-medium">{branch.principal}</TableCell>
                <TableCell />
                <TableCell className="text-right font-mono font-medium">{branch.required}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {figures.map(([label, value]) => (
            <div key={label} className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-mono text-sm font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
