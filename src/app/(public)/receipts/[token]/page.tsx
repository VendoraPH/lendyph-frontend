"use client";

import { use, useEffect, useRef, useState } from "react";
import { Loader2, ReceiptText } from "lucide-react";
import { publicReceiptErrorMessage, publicReceiptService } from "@/services/public-receipt.service";
import { mapPaymentToReceipt, type ReceiptData } from "@/app/(app)/payments/_lib/receipt-data";
import { ReceiptCard } from "@/app/(app)/payments/_components/receipt-card";
import { DownloadReceiptImageButton } from "@/app/(app)/payments/_components/download-receipt-image-button";

type Loaded = { token: string; receipt: ReceiptData | null; error: string | null };

/** A payment receipt opened from a share link: no sign-in, this receipt only. */
export default function SharedReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    publicReceiptService
      .detail(token)
      .then((payment) => live && setLoaded({ token, receipt: mapPaymentToReceipt(payment), error: null }))
      .catch((err) => live && setLoaded({ token, receipt: null, error: publicReceiptErrorMessage(err) }));
    return () => {
      live = false;
    };
  }, [token]);

  const current = loaded?.token === token ? loaded : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-8">
      {!current && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Loading receipt…</p>
        </div>
      )}

      {current?.error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <ReceiptText className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-semibold">Receipt unavailable</p>
          <p className="text-sm text-muted-foreground">{current.error}</p>
        </div>
      )}

      {current?.receipt && (
        <>
          {current.receipt.status === "voided" && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-center text-sm font-semibold text-destructive"
            >
              This payment has been voided. The receipt is no longer valid proof of payment.
            </p>
          )}
          <ReceiptCard ref={cardRef} receipt={current.receipt} variant="public" />
          <DownloadReceiptImageButton
            target={cardRef}
            receiptNumber={current.receipt.receipt_number}
            className="w-full sm:mx-auto sm:w-auto"
          />
        </>
      )}
    </main>
  );
}
