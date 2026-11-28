"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cicService } from "@/services";

/**
 * Upload CIC's ASCII-armored public key, pasted or as the .asc file CIC sent.
 * The server reads it, refuses a private key, several keys or an expired one,
 * and stores it waiting for a second person to verify it.
 */
export function UploadKeyDialog({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [armored, setArmored] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  if (useDialogOpening(open, "upload")) {
    setArmored("");
    setFile(null);
  }

  const upload = () => {
    setBusy(true);
    (file ? cicService.uploadPublicKeyFile(file) : cicService.uploadPublicKeyText(armored.trim()))
      .then(() => {
        notifySuccess("Key uploaded. Someone else with CIC settings access must verify its fingerprint with CIC.");
        onUploaded();
        onOpenChange(false);
      })
      .catch((err) => notifyError(err, "The key could not be uploaded."))
      .then(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload CIC&apos;s Public Key</DialogTitle>
          <DialogDescription>
            Paste the key block CIC sent (it starts with &quot;-----BEGIN PGP PUBLIC KEY BLOCK-----&quot;), or choose
            its .asc file. Never upload a private key.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cic-key-armored">Key</Label>
            <Textarea
              id="cic-key-armored"
              className="h-48 font-mono text-xs"
              spellCheck={false}
              disabled={file !== null}
              value={armored}
              onChange={(e) => setArmored(e.target.value)}
            />
          </div>
          <input
            ref={input}
            type="file"
            accept=".asc,.txt,.pub,.key"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button type="button" variant="outline" onClick={() => input.current?.click()}>
              Choose File
            </Button>
            {file ? (
              <>
                <span className="font-mono text-xs">{file.name}</span>
                <Button type="button" variant="ghost" onClick={() => setFile(null)}>
                  Remove
                </Button>
              </>
            ) : (
              <span className="text-muted-foreground">or paste the key above</span>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button disabled={busy || (!file && !armored.trim())} onClick={upload}>
            {busy ? "Uploading…" : "Upload Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
