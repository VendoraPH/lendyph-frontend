"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PermissionButton } from "@/components/common/permission-button";
import { formatDateTime } from "@/lib/format";
import type { CicSubmission } from "@/types/cic";
import { SubmissionStatusBadge } from "../../_components/submission-status-badge";
import type { useSubmissionActions } from "../../_hooks/use-submission-actions";

type Actions = ReturnType<typeof useSubmissionActions>;

function Facts({ submission }: { submission: CicSubmission }) {
  return (
    <dl className="grid max-w-xl grid-cols-[10rem_1fr] gap-x-4 gap-y-1.5 text-sm">
      <dt className="text-muted-foreground">File</dt>
      <dd className="font-mono text-xs">{submission.filename}</dd>
      <dt className="text-muted-foreground">Status</dt>
      <dd>
        <SubmissionStatusBadge status={submission.status} />
      </dd>
      <dt className="text-muted-foreground">Records</dt>
      <dd>{submission.record_count}</dd>
      <dt className="text-muted-foreground">Checksum (SHA-256)</dt>
      <dd className="break-all font-mono text-xs">{submission.checksum ?? "—"}</dd>
      {submission.encrypted_filename && (
        <>
          <dt className="text-muted-foreground">Encrypted file</dt>
          <dd className="font-mono text-xs">{submission.encrypted_filename}</dd>
          <dt className="text-muted-foreground">Encrypted checksum</dt>
          <dd className="break-all font-mono text-xs">{submission.encrypted_checksum ?? "—"}</dd>
        </>
      )}
      {submission.key_fingerprint && (
        <>
          <dt className="text-muted-foreground">Encrypted for key</dt>
          <dd className="break-all font-mono text-xs">{submission.key_fingerprint}</dd>
        </>
      )}
      {submission.submitted_at && (
        <>
          <dt className="text-muted-foreground">Submitted</dt>
          <dd>{formatDateTime(submission.submitted_at)}</dd>
        </>
      )}
    </dl>
  );
}

/** Steps 6 to 8: encrypt with CIC's key, download, and record the upload to CIC's portal. */
export function LifecycleStep({
  step,
  submission,
  keyFingerprint,
  actions,
  onDownloaded,
}: {
  step: 5 | 6 | 7;
  submission: CicSubmission;
  /** The key the reviewer confirmed on the Review step. */
  keyFingerprint: string;
  actions: Actions;
  onDownloaded: () => void;
}) {
  return (
    <div className="space-y-5">
      <Facts submission={submission} />
      {step === 5 && (
        <div className="space-y-2">
          <p className="max-w-xl text-sm text-muted-foreground">
            Lendy zips the file and encrypts the zip with the public key CIC issued, giving a{" "}
            <span className="font-mono">.zip.gpg</span> only CIC can open. The plain file never leaves the server.
          </p>
          <PermissionButton
            permission="cic:submit"
            disabled={submission.status !== "generated" || actions.busy !== null}
            onClick={() => actions.encrypt(submission, keyFingerprint)}
          >
            {actions.busy === "encrypt" ? "Encrypting…" : submission.status === "generated" ? "Encrypt File" : "Encrypted"}
          </PermissionButton>
        </div>
      )}
      {step === 6 && (
        <div className="space-y-2">
          <p className="max-w-xl text-sm text-muted-foreground">
            Download <span className="font-mono">{submission.encrypted_filename}</span>, then upload it to CIC&apos;s
            submission portal.
          </p>
          <PermissionButton
            permission="cic:submit"
            disabled={actions.busy !== null}
            onClick={async () => {
              if (await actions.download(submission)) onDownloaded();
            }}
          >
            {actions.busy === "download" ? "Downloading…" : "Download Encrypted File"}
          </PermissionButton>
        </div>
      )}
      {step === 7 && (
        <div className="space-y-2">
          <p className="max-w-xl text-sm text-muted-foreground">
            Once the file is uploaded to CIC, mark it submitted. Record CIC&apos;s acceptance or rejection on the
            submission when it arrives.
          </p>
          <div className="flex flex-wrap gap-2">
            <PermissionButton
              permission="cic:submit"
              disabled={submission.status !== "encrypted" || actions.busy !== null}
              onClick={() => actions.markSubmitted(submission)}
            >
              {actions.busy === "submit"
                ? "Saving…"
                : submission.status === "encrypted"
                  ? "Mark Submitted to CIC"
                  : "Submitted"}
            </PermissionButton>
            <Button variant="outline" nativeButton={false} render={<Link href={`/cic/submissions/${submission.id}`} />}>
              Open Submission
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
