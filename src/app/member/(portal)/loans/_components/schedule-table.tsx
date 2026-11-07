import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { SCHEDULE_STATUS } from "@/lib/portal/finance";
import { TONE_CLASS } from "@/lib/portal/labels";
import type { PortalScheduleRow } from "@/types/portal";
import { StatusPill } from "../../../_components/portal-shell";

/** The amortization schedule, as the server computed it. */
export function ScheduleTable({ rows }: { rows: PortalScheduleRow[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No schedule yet.</p>;
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Due date</TableHead>
            <TableHead className="hidden text-right md:table-cell">Principal</TableHead>
            <TableHead className="hidden text-right md:table-cell">Interest</TableHead>
            <TableHead className="text-right">Amount due</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Paid</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const st = SCHEDULE_STATUS[r.status] ?? { label: r.status, tone: "muted" as const };
            return (
              <TableRow key={r.installment_no}>
                <TableCell>{r.installment_no}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(r.due_date)}</TableCell>
                <TableCell className="hidden text-right md:table-cell">{formatCurrency(r.principal)}</TableCell>
                <TableCell className="hidden text-right md:table-cell">{formatCurrency(r.interest)}</TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium">{formatCurrency(r.total_due)}</TableCell>
                <TableCell className="hidden text-right sm:table-cell">{formatCurrency(r.amount_paid)}</TableCell>
                <TableCell>
                  <StatusPill className={TONE_CLASS[st.tone]}>{st.label}</StatusPill>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
