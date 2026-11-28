"use client";

import { useState } from "react";
import { ScrollBox } from "@/components/common/page-fill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDialogOpening } from "@/hooks";
import type { CicSubmissionDetail } from "@/types/cic";
import { EncryptConfirmation } from "../../../_components/encrypt-confirmation";
import { SubmissionReview } from "../../../_components/submission-review";
import { encryptBlockedReason } from "../../../_lib/encrypt-gate";

/** The pre-encryption review and the explicit confirmation, then `{confirm: true}`. */
export function EncryptDialog({
  open,
  onOpenChange,
  detail,
  busy,
  onEncrypt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: CicSubmissionDetail;
  busy: boolean;
  /** Resolves true once encrypted, which closes the dialog. */
  onEncrypt: () => Promise<boolean>;
}) {
  const [confirmed, setConfirmed] = useState(false);
  if (useDialogOpening(open, detail.id)) setConfirmed(false);
  const blocked = encryptBlockedReason(detail);

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Review and Encrypt</DialogTitle>
          <DialogDescription>
            Check the file before the server zips it and encrypts it to a <span className="font-mono">.zip.gpg</span>{" "}
            for CIC. Only the encrypted file can be downloaded.
          </DialogDescription>
        </DialogHeader>
        <ScrollBox always className="max-h-[55vh] p-px">
          <SubmissionReview detail={detail} />
        </ScrollBox>
        <EncryptConfirmation detail={detail} confirmed={confirmed} onConfirmedChange={setConfirmed} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={!confirmed || blocked !== null || busy}
            onClick={async () => {
              if (await onEncrypt()) onOpenChange(false);
            }}
          >
            {busy ? "Encrypting…" : "Zip and Encrypt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
