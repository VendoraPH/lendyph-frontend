"use client";

import { useCallback, useState } from "react";
import { DataState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApiResource, useDialogOpening } from "@/hooks";
import { cicKeyProblem } from "@/lib/cic/rules";
import { cicService } from "@/services";
import type { CicSubmission } from "@/types/cic";
import { EncryptReview } from "../../../_components/encrypt-review";

/** The review and explicit confirmation before a stored file is zipped and encrypted. Mounted only while open. */
function EncryptBody({
  submission,
  busy,
  onCancel,
  onEncrypt,
}: {
  submission: CicSubmission;
  busy: boolean;
  onCancel: () => void;
  onEncrypt: (keyFingerprint: string) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [now] = useState(() => new Date());
  const fetcher = useCallback(() => cicService.getSettings(), []);
  const settings = useApiResource(fetcher);

  return (
    <DataState resource={settings} summary="CIC's public key, to encrypt the file for." endpoints={["GET /cic/settings"]}>
      {(st) => {
        const problem = cicKeyProblem(st.public_key, now);
        const fingerprint = problem ? null : (st.public_key?.fingerprint ?? null);
        return (
          <>
            {problem && <p className="text-sm text-destructive">{problem}</p>}
            <div className="flex max-h-[60vh] min-h-0 flex-col">
              <EncryptReview
                submission={submission}
                keyFingerprint={fingerprint}
                confirmed={confirmed}
                onConfirmedChange={setConfirmed}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onCancel} disabled={busy}>
                Cancel
              </Button>
              <Button disabled={!confirmed || !fingerprint || busy} onClick={() => fingerprint && onEncrypt(fingerprint)}>
                {busy ? "Encrypting…" : "Zip and Encrypt"}
              </Button>
            </DialogFooter>
          </>
        );
      }}
    </DataState>
  );
}

export function EncryptDialog({
  open,
  onOpenChange,
  submission,
  busy,
  onEncrypt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: CicSubmission;
  busy: boolean;
  /** Resolves true once encrypted, which closes the dialog. */
  onEncrypt: (keyFingerprint: string) => Promise<boolean>;
}) {
  // A fresh body per opening, so the confirmation never carries over.
  const [opening, setOpening] = useState(0);
  if (useDialogOpening(open, submission.id)) setOpening((n) => n + 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Review and Encrypt</DialogTitle>
          <DialogDescription>
            Check the file before it is zipped and encrypted to a <span className="font-mono">.zip.gpg</span> for CIC.
            Only the encrypted file can be downloaded.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <EncryptBody
            key={opening}
            submission={submission}
            busy={busy}
            onCancel={() => onOpenChange(false)}
            onEncrypt={async (fp) => {
              if (await onEncrypt(fp)) onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
