"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, ReceiptText, Ban, Loader2 } from "lucide-react";
import { usePrintables } from "@/hooks";
import { PermissionButton, RouteGuard } from "@/components/common";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FIT_CLASSES } from "@/lib/page-fill";
import { repaymentService } from "@/services";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { notifyError } from "@/lib/notify";
import { mapPaymentToReceipt, type ReceiptData } from "../_lib/receipt-data";
import { ReceiptCard } from "../_components/receipt-card";
import { DownloadReceiptImageButton } from "@/components/receipts/download-receipt-image-button";
import { ShareReceiptLink } from "../_components/share-receipt-link";

function PaymentReceiptContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  // The card below stays the on-screen view; what comes off the printer is the
  // catalog's Official Receipt — two copies, Borrower's and File.
  const printables = usePrintables();

  const fetchReceipt = useCallback(async () => {
    setLoading(true);
    try {
      const repayment = await repaymentService.detail(Number(id));
      if (!repayment) {
        setNotFound(true);
        return;
      }
      setReceipt(mapPaymentToReceipt(repayment));
    } catch {
      setNotFound(true);
      toast.error("We couldn't load the receipt. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  async function handleVoid() {
    if (!receipt || !voidReason.trim()) return;
    setVoiding(true);
    try {
      await repaymentService.void(receipt.id, { void_reason: voidReason.trim() });
      toast.success("Payment voided");
      setShowVoidConfirm(false);
      setVoidReason("");
      fetchReceipt();
    } catch (err) {
      // The server explains a refusal (e.g. a payment made before an extension).
      notifyError(err, "We couldn't void the payment. Please try again.");
    } finally {
      setVoiding(false);
    }
  }

  if (loading) {
    return (
      <div className={cn(FIT_CLASSES.loader, "flex-col gap-3")}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading receipt...</p>
      </div>
    );
  }

  if (notFound || !receipt) {
    return (
      <div className={cn(FIT_CLASSES.loader, "flex-col gap-4")}>
        <ReceiptText className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-semibold">Receipt not found</p>
        <p className="text-sm text-muted-foreground">
          No receipt exists for ID {id}.
        </p>
        <Link
          href="/payments"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Payments
        </Link>
      </div>
    );
  }

  return (
    <PageFill>
      {/* Screen-only header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Link
          href="/payments"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 w-fit")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Payments
        </Link>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          {receipt.status === "completed" && (
            <PermissionButton
              permission="payments:void"
              tooltip="Your role doesn't have permission to void payments"
              variant="destructive"
              size="sm"
              onClick={() => setShowVoidConfirm(true)}
            >
              <Ban className="mr-2 h-4 w-4" />
              Void Payment
            </PermissionButton>
          )}
          <ShareReceiptLink repaymentId={receipt.id} />
          <DownloadReceiptImageButton target={cardRef} receiptNumber={receipt.receipt_number} />
          {/* Both buttons open the same document, and that is deliberate: an
              Official Receipt is issued under the payment's own receipt number,
              so a reprint is the same paper, not a new one. Printing the React
              card instead — which is what these used to do — produced an
              on-screen mock-up with no letterhead and only one copy. */}
          <Button
            variant="outline"
            size="sm"
            disabled={printables.isPreparing}
            onClick={() => printables.open("official_receipt", receipt.id)}
          >
            {printables.isPreparing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            {printables.isPreparing ? "Preparing…" : "Print Receipt"}
          </Button>
          <Button
            size="sm"
            disabled={printables.isPreparing}
            onClick={() => printables.open("official_receipt", receipt.id)}
          >
            <Printer className="mr-2 h-4 w-4" />
            Reprint
          </Button>
        </div>
      </div>

      {/* Void confirmation: outside the scroll box, so it shows under the
          header's Void button however far the receipt is scrolled. */}
      {showVoidConfirm && (
        <div className="shrink-0 print:hidden">
          <Card className="mx-auto max-w-md border-destructive/30">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold text-destructive">Void this payment?</p>
              <p className="text-xs text-muted-foreground">
                This action cannot be undone. The payment of {formatCurrency(receipt.total)} for {receipt.borrower_name} will be voided.
              </p>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Reason for voiding (required)"
                rows={2}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowVoidConfirm(false);
                    setVoidReason("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={voiding || !voidReason.trim()}
                  onClick={handleVoid}
                >
                  {voiding ? "Voiding..." : "Confirm Void"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* The receipt scrolls under the header. Print shows all of it (globals.css). */}
      <ScrollBox className="space-y-6 p-px">
        <ReceiptCard ref={cardRef} receipt={receipt} />
      </ScrollBox>
    </PageFill>
  );
}

export default function PaymentReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RouteGuard permission="payments:view" pageName="Payment Receipt">
      <PaymentReceiptContent params={params} />
    </RouteGuard>
  );
}
