"use client";

import { useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cicService } from "@/services";
import { daysFromToday, formatDate, formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/notify";
import type { CicSettings } from "@/types/cic";

/** An armored public key is a few kilobytes; anything far larger is not one. */
const MAX_KEY_BYTES = 64 * 1024;

/**
 * CIC's PGP public key, which every file is encrypted with. Only the public
 * key is ever uploaded: the private key stays with CIC.
 */
export function PublicKeyCard({
  settings,
  onChange,
}: {
  settings: CicSettings;
  onChange: (settings: CicSettings) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const key = settings.public_key;
  const expiresIn = key?.expires_at ? daysFromToday(key.expires_at) : null;

  const upload = async (file: File) => {
    if (file.size > MAX_KEY_BYTES) {
      notifyWarning("That file is too large to be a public key.");
      return;
    }
    setBusy(true);
    try {
      const public_key = await cicService.uploadPublicKey(file);
      setBusy(false);
      notifySuccess("CIC's public key uploaded.");
      onChange({ ...settings, public_key });
    } catch (err) {
      setBusy(false);
      notifyError(err, "The key could not be read. Upload the armored public key CIC sent (.asc).");
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await cicService.removePublicKey();
      setBusy(false);
      notifySuccess("Public key removed.");
      onChange({ ...settings, public_key: null });
    } catch (err) {
      setBusy(false);
      notifyError(err, "The key could not be removed.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Encryption Key</CardTitle>
        <CardDescription>
          The PGP public key CIC issued. Files are encrypted with it before download, so only CIC can open them.
        </CardDescription>
      </CardHeader>
      <CardContent className="max-w-2xl space-y-4">
        {key ? (
          <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Fingerprint</dt>
            <dd className="break-all font-mono text-xs">{key.fingerprint}</dd>
            <dt className="text-muted-foreground">Algorithm</dt>
            <dd>{key.algorithm ?? "—"}</dd>
            <dt className="text-muted-foreground">Issued to</dt>
            <dd>{key.user_id ?? "—"}</dd>
            <dt className="text-muted-foreground">Expires</dt>
            <dd>{key.expires_at ? formatDate(key.expires_at) : "Never"}</dd>
            <dt className="text-muted-foreground">Uploaded</dt>
            <dd>
              {formatDateTime(key.uploaded_at)}
              {key.uploaded_by ? ` by ${key.uploaded_by}` : ""}
            </dd>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No key yet. A file cannot be encrypted until one is uploaded.</p>
        )}
        {expiresIn !== null && expiresIn <= 30 && (
          <Alert variant={expiresIn < 0 ? "destructive" : "default"}>
            <AlertDescription>
              {expiresIn < 0
                ? "This key has expired. Ask CIC for its new public key."
                : `This key expires in ${expiresIn} ${expiresIn === 1 ? "day" : "days"}. Ask CIC for its new public key.`}
            </AlertDescription>
          </Alert>
        )}
        <input
          ref={input}
          type="file"
          accept=".asc,.gpg,.pgp,.pub,.key,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) upload(file);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => input.current?.click()}>
            {key ? "Replace Key" : "Upload Key"}
          </Button>
          {key && (
            <Button variant="outline" disabled={busy} onClick={remove}>
              Remove Key
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
