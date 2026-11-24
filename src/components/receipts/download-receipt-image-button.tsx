"use client";

import { useState, type RefObject } from "react";
import { ImageDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadNodeAsPng } from "@/lib/download-node-png";
import { notifyError } from "@/lib/notify";
import { receiptImageFileName } from "@/lib/receipt-image";

interface DownloadReceiptImageButtonProps {
  /** The receipt card to capture. */
  target: RefObject<HTMLDivElement | null>;
  receiptNumber: string;
  className?: string;
}

/**
 * Saves the on-screen receipt card as a PNG, named after its receipt number:
 * the staff receipt page and the public shared receipt (/r/{token}).
 */
export function DownloadReceiptImageButton({ target, receiptNumber, className }: DownloadReceiptImageButtonProps) {
  const [busy, setBusy] = useState(false);

  function download() {
    const node = target.current;
    if (!node || busy) return;
    setBusy(true);
    downloadNodeAsPng(node, receiptImageFileName(receiptNumber))
      .catch((err) => notifyError(err, "We couldn't create the receipt image. Please try again."))
      .then(() => setBusy(false));
  }

  return (
    <Button variant="outline" size="sm" className={className} disabled={busy} onClick={download}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageDown className="mr-2 h-4 w-4" />}
      {busy ? "Preparing…" : "Download Image"}
    </Button>
  );
}
