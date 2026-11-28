"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDialogOpening } from "@/hooks";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cicService } from "@/services";
import type { CicPublicKey } from "@/types/cic";

/** Fingerprints compare without spaces or case: CIC may read one out in groups of four. */
const normalize = (fp: string) => fp.replace(/\s+/g, "").toUpperCase();

/**
 * Verifying the key: the admin types the fingerprint CIC gave them out of
 * band (a call or a signed letter), and it must match the uploaded key. A
 * key that is not verified cannot encrypt a file.
 */
export function VerifyKeyDialog({
  open,
  onOpenChange,
  publicKey,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicKey: CicPublicKey;
  onVerified: (key: CicPublicKey) => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  if (useDialogOpening(open, publicKey.id)) setTyped("");
  const matches = typed.trim() !== "" && normalize(typed) === normalize(publicKey.fingerprint);

  const verify = () => {
    setBusy(true);
    cicService
      .verifyPublicKey(normalize(typed))
      .then((key) => {
        notifySuccess("CIC's public key verified.");
        onVerified(key);
        onOpenChange(false);
      })
      .catch((err) => notifyError(err, "The key could not be verified."))
      .then(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify CIC&apos;s Public Key</DialogTitle>
          <DialogDescription>
            Type the fingerprint CIC gave you directly, by phone or in its signed letter, not one copied from this
            screen. It must match the uploaded key.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cic-key-fingerprint">Fingerprint from CIC</Label>
          <Input
            id="cic-key-fingerprint"
            autoComplete="off"
            className="font-mono"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          {typed.trim() !== "" && !matches && (
            <p className="text-xs text-destructive">
              This does not match the uploaded key. Do not verify it: ask CIC to confirm its key.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button disabled={!matches || busy} onClick={verify}>
            {busy ? "Verifying…" : "Verify Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
