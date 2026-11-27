"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, ReceiptText } from "lucide-react";
import { PoweredByLendy } from "@/components/common/powered-by-lendy";
import { DownloadReceiptImageButton } from "@/components/receipts/download-receipt-image-button";
import { PUBLIC_RECEIPT_UNAVAILABLE, isShareToken, publicReceiptErrorMessage } from "@/lib/receipt-share";
import { publicReceiptService } from "@/services/public-receipt.service";
import type { PublicReceipt } from "@/types/receipt-share";
import { PublicReceiptCard } from "./_components/public-receipt-card";

type Loaded = { token: string; receipt: PublicReceipt | null; error: string | null };

/**
 * A shared payment receipt (finish run round 2, decision 6): no sign-in, no
 * app shell and no staff token. It shows the server's masked receipt and saves
 * it as a PNG with Download Image. A link that doesn't open reads one message,
 * whatever the reason; a malformed address isn't even asked about.
 */
export default function SharedReceiptPage() {
  const { token } = useParams<{ token: string }>();
  const wellFormed = isShareToken(token);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wellFormed) return;
    let live = true;
    publicReceiptService
      .show(token)
      .then((receipt) => live && setLoaded({ token, receipt, error: null }))
      .catch((err: unknown) => live && setLoaded({ token, receipt: null, error: publicReceiptErrorMessage(err) }));
    return () => {
      live = false;
    };
  }, [token, wellFormed]);

  const current: Loaded | null = !wellFormed
    ? { token, receipt: null, error: PUBLIC_RECEIPT_UNAVAILABLE }
    : loaded?.token === token
      ? loaded
      : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8">
      {current === null ? (
        <p className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading receipt…
        </p>
      ) : current.receipt ? (
        <>
          <PublicReceiptCard ref={cardRef} receipt={current.receipt} />
          <div className="flex justify-center">
            <DownloadReceiptImageButton target={cardRef} receiptNumber={current.receipt.receipt_number} />
          </div>
        </>
      ) : (
        <div className="rounded-xl border bg-card p-6 text-center">
          <ReceiptText className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold">Receipt not available</h1>
          <p className="mt-2 text-sm text-muted-foreground">{current.error}</p>
        </div>
      )}
      <div className="flex justify-center">
        <PoweredByLendy />
      </div>
    </main>
  );
}
