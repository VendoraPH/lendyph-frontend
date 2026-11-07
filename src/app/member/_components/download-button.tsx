"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { httpStatusOf } from "@/lib/api-error";
import { notifyError, notifyInfo } from "@/lib/notify";
import { saveFile } from "@/lib/portal/save-file";

interface DownloadButtonProps {
  /** Fetches the file; called on click. */
  fetchFile: () => Promise<Blob>;
  filename: string;
  label: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
}

/**
 * A download failure. A blob error body carries no readable message, so a route
 * that is not built yet (404/501) gets its own calm notice instead of an error.
 */
export function notifyDownloadError(err: unknown, notYet: string): void {
  const status = httpStatusOf(err);
  if (status === 404 || status === 501) notifyInfo(notYet);
  else notifyError(err, "The file could not be downloaded. Please try again.");
}

/**
 * Downloads a PDF the member is entitled to (statement, receipt, certificate).
 */
export function DownloadButton({ fetchFile, filename, label, variant = "outline", size = "sm" }: DownloadButtonProps) {
  const [busy, setBusy] = useState(false);

  const download = () => {
    setBusy(true);
    fetchFile()
      .then((blob) => saveFile(blob, filename))
      .catch((err) => notifyDownloadError(err, "This document is not available online yet."))
      .finally(() => setBusy(false));
  };

  return (
    <Button variant={variant} size={size} onClick={download} disabled={busy}>
      {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
      {label}
    </Button>
  );
}
