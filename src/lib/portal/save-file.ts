import type { DownloadedFile } from "./portal-client";

/**
 * Saves a downloaded file under the server's name (else `fallbackName`). The
 * file came through the signed-in portal client, never a signed or public
 * link, so the browser keeps only a short-lived object URL.
 */
export function saveFile(file: DownloadedFile, fallbackName: string): void {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename || fallbackName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
