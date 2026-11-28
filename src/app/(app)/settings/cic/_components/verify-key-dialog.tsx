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

/**
 * A second person verifies the key: they type the fingerprint CIC gave them
 * directly (a call or a signed letter). The server compares it with the
 * uploaded key and activates it, retiring the one before.
 */
export function VerifyKeyDialog({
  publicKey,
  onOpenChange,
  onVerified,
}: {
  publicKey: CicPublicKey | null;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
}) {
  const open = publicKey !== null;
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  if (useDialogOpening(open, publicKey?.id)) setTyped("");

  const verify = () => {
    if (!publicKey) return;
    setBusy(true);
    cicService
      .verifyPublicKey(publicKey.id, typed.trim())
      .then(() => {
        notifySuccess("CIC's public key verified. It encrypts every new file from now on.");
        onVerified();
        onOpenChange(false);
      })
      .catch((err) => notifyError(err, "The key could not be verified."))
      .then(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify CIC&apos;s Public Key</DialogTitle>
          <DialogDescription>
            Type the fingerprint CIC gave you directly, by phone or in its signed letter, not one copied from this
            screen. The server checks that it matches key {publicKey?.key_id}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cic-key-fingerprint">Fingerprint from CIC</Label>
          <Input
            id="cic-key-fingerprint"
            autoComplete="off"
            className="font-mono"
            maxLength={200}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button disabled={!typed.trim() || busy} onClick={verify}>
            {busy ? "Verifying…" : "Verify Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
