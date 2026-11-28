"use client";

import { Button } from "@/components/ui/button";
import type { CicSubmissionDetail } from "@/types/cic";
import { encryptBlockedReason } from "../../_lib/encrypt-gate";

/** Step 4: the server zips and encrypts, once the review is confirmed. */
export function EncryptStep({
  submission,
  confirmed,
  busy,
  onEncrypt,
}: {
  submission: CicSubmissionDetail;
  confirmed: boolean;
  busy: boolean;
  onEncrypt: () => void;
}) {
  if (submission.status !== "generated") {
    return (
      <p className="text-sm">
        Encrypted to <span className="font-mono">{submission.encrypted_filename}</span>. The plain file never leaves the
        server.
      </p>
    );
  }
  const blocked = encryptBlockedReason(submission);
  return (
    <div className="space-y-2">
      {blocked && <p className="text-sm text-destructive">{blocked}</p>}
      <Button type="button" disabled={!confirmed || blocked !== null || busy} onClick={onEncrypt}>
        {busy ? "Encrypting…" : "Zip and Encrypt"}
      </Button>
    </div>
  );
}

/** Step 5: the `.zip.gpg` only. */
export function DownloadStep({
  submission,
  busy,
  onDownload,
}: {
  submission: CicSubmissionDetail;
  busy: boolean;
  onDownload: () => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm">
        Download <span className="font-mono">{submission.encrypted_filename ?? "the encrypted file"}</span>, then upload
        it on CIC&apos;s submission portal.
      </p>
      {submission.actions.download ? (
        <Button type="button" disabled={busy} onClick={onDownload}>
          {busy ? "Downloading…" : "Download Encrypted File"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">You can&apos;t download CIC files.</p>
      )}
    </div>
  );
}
