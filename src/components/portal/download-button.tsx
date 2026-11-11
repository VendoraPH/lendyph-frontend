"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { withBlobErrorBody } from "@/lib/portal/errors";
import { notifyPortalError } from "@/lib/portal/notify-error";
import type { DownloadedFile } from "@/lib/portal/portal-client";
import { saveFile } from "@/lib/portal/save-file";

interface DownloadButtonProps {
  download: () => Promise<DownloadedFile>;
  /** The file name when the server sends none. */
  fileName: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm";
  disabled?: boolean;
}

/** A PDF or shared file, fetched with the member's session and saved; one at a time. */
export function DownloadButton({ download, fileName, children, variant = "outline", size = "sm", disabled }: DownloadButtonProps) {
  const [busy, setBusy] = useState(false);

  const onClick = () => {
    if (busy) return;
    setBusy(true);
    download()
      .then((file) => saveFile(file, fileName))
      .catch(async (err: unknown) => {
        const readable = await withBlobErrorBody(err);
        notifyPortalError(readable, "We couldn't get that file. Please try again.");
      })
      .then(() => setBusy(false));
  };

  return (
    <Button variant={variant} size={size} onClick={onClick} disabled={disabled || busy} aria-busy={busy}>
      {busy ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" aria-hidden />}
      {children}
    </Button>
  );
}
