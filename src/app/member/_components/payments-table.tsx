import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { humanize } from "@/lib/portal/labels";
import { portalService } from "@/services/portal.service";
import type { PortalPayment } from "@/types/portal";
import { DownloadButton } from "./download-button";

/** Payments the cooperative has posted, with the official receipt where one exists. */
export function PaymentsTable({ payments, showLoan = true }: { payments: PortalPayment[]; showLoan?: boolean }) {
  if (payments.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No payments yet.</p>;
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Receipt</TableHead>
            {showLoan && <TableHead className="hidden md:table-cell">Loan</TableHead>}
            <TableHead className="hidden sm:table-cell">Method</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="whitespace-nowrap">{formatDate(p.paid_at)}</TableCell>
              <TableCell className="whitespace-nowrap">{p.receipt_number}</TableCell>
              {showLoan && <TableCell className="hidden md:table-cell">{p.loan_number ?? "—"}</TableCell>}
              <TableCell className="hidden sm:table-cell">{humanize(p.method)}</TableCell>
              <TableCell className="whitespace-nowrap text-right font-medium">{formatCurrency(p.amount)}</TableCell>
              <TableCell>
                {p.has_receipt && (
                  <DownloadButton
                    variant="ghost"
                    label="Receipt"
                    filename={`receipt-${p.receipt_number}.pdf`}
                    fetchFile={() => portalService.paymentReceipt(p.id)}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
