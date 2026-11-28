"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { CicSubmissionDetail } from "@/types/cic";
import { encryptBlockedReason } from "../_lib/encrypt-gate";

/** The reviewer's explicit confirmation before encrypting; off while the server says the file can't be encrypted. */
export function EncryptConfirmation({
  detail,
  confirmed,
  onConfirmedChange,
}: {
  detail: CicSubmissionDetail;
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
}) {
  const blocked = encryptBlockedReason(detail);
  return (
    <div className="space-y-2">
      {blocked && <p className="text-sm text-destructive">{blocked}</p>}
      <Label className="flex items-start gap-2 text-sm font-normal">
        <Checkbox
          checked={confirmed && !blocked}
          disabled={blocked !== null}
          onCheckedChange={(on) => onConfirmedChange(on === true)}
        />
        I reviewed this file and confirm it is ready to be zipped and encrypted for CIC with the key shown.
      </Label>
    </div>
  );
}
