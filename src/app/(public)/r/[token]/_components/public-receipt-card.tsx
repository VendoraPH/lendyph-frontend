import type { Ref } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/format";
import { publicReceiptLines, referenceEnding } from "@/lib/receipt-share";
import { publicReceiptLogoUrl } from "@/services/public-receipt.service";
import type { PublicReceipt } from "@/types/receipt-share";

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 text-sm ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-mono">{value}</span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{children}</p>;
}

interface PublicReceiptCardProps {
  receipt: PublicReceipt;
  /** The node "Download Image" captures. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * A shared receipt, exactly as the server masked it (finish run round 2,
 * decision 6): the cooperative's name and logo, the receipt number and date,
 * the member's initials and surname, the method with the last 4 characters of
 * its reference, and the amount paid with its breakdown. A voided payment is
 * marked VOIDED with its date, on the card and on the saved image.
 */
export function PublicReceiptCard({ receipt, ref }: PublicReceiptCardProps) {
  const logo = publicReceiptLogoUrl(receipt.cooperative.logo_url);
  const reference = referenceEnding(receipt.reference_last4);
  const voided = receipt.status === "voided";

  return (
    <div ref={ref} className="mx-auto w-full max-w-md">
      <Card className="relative overflow-hidden border shadow-md">
        {voided && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex select-none items-center justify-center text-7xl font-black tracking-widest text-destructive/10 [transform:rotate(-24deg)]"
          >
            VOIDED
          </span>
        )}
        <CardContent className="p-0">
          <div className="flex items-center gap-3 border-b px-6 py-4">
            {logo && (
              // `unoptimized`: the API's own file through the same-origin proxy, so the saved image can draw it.
              <span className="relative inline-block h-10 w-10 shrink-0">
                <Image src={logo} alt="" fill unoptimized className="object-contain" />
              </span>
            )}
            <div className="min-w-0">
              <p className="font-semibold leading-tight">{receipt.cooperative.name}</p>
              <p className="text-sm text-muted-foreground">Official Payment Receipt</p>
            </div>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Receipt No.</p>
                <p className="font-mono text-base font-bold">{receipt.receipt_number}</p>
              </div>
              <div className="space-y-0.5 text-right">
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm font-medium">{receipt.payment_date ? formatDate(receipt.payment_date) : "—"}</p>
              </div>
            </div>

            {voided && (
              <div className="rounded-md border-2 border-destructive bg-destructive/10 px-3 py-2 text-center" role="status">
                <p className="text-base font-black uppercase tracking-widest text-destructive">Voided</p>
                <p className="text-xs text-destructive">
                  {receipt.voided_on ? `Voided on ${formatDate(receipt.voided_on)}. ` : ""}This payment no longer counts.
                </p>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <SectionHeading>Payment Details</SectionHeading>
              <div className="space-y-1.5">
                <Row label="Member" value={receipt.member_name} />
                <Row label="Payment Method" value={receipt.method ?? "—"} />
                {reference && <Row label="Reference No." value={reference} />}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <SectionHeading>Payment Breakdown</SectionHeading>
              <div className="space-y-1.5">
                {publicReceiptLines(receipt).map((line) => (
                  <Row key={line.label} label={line.label} value={line.amount} />
                ))}
              </div>
              <Separator className="my-1" />
              <div className={`flex justify-between text-sm font-bold ${voided ? "text-destructive" : ""}`}>
                <span>Total Paid</span>
                <span className={`font-mono text-base ${voided ? "line-through" : ""}`}>{formatCurrency(receipt.amount_paid)}</span>
              </div>
            </div>

            <div className="flex justify-center">
              <Badge
                variant="outline"
                className={
                  voided
                    ? "bg-destructive/10 text-destructive border-destructive/20"
                    : "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
                }
              >
                {voided ? "Voided" : "Completed"}
              </Badge>
            </div>

            <div className="rounded-md bg-muted/50 px-4 py-3 text-center">
              <p className="text-[11px] text-muted-foreground">This receipt is system-generated.</p>
              <p className="text-[11px] text-muted-foreground">It was shared by {receipt.cooperative.name} and shows only this payment.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
