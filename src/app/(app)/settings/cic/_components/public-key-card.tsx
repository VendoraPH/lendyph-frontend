"use client";

import { useRef, useState } from "react";
import { ReasonDialog } from "@/components/common/reason-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cicService } from "@/services";
import { daysFromToday, formatDate, formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/notify";
import type { CicKeyStatus, CicSettings } from "@/types/cic";
import { KeyHistory } from "./key-history";
import { VerifyKeyDialog } from "./verify-key-dialog";

/** An armored public key is a few kilobytes; anything far larger is not one. */
const MAX_KEY_BYTES = 64 * 1024;

const STATUS: Record<CicKeyStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  valid: { label: "Verified", variant: "default" },
  unverified: { label: "Not verified", variant: "secondary" },
  expired: { label: "Expired", variant: "destructive" },
};

/**
 * CIC's PGP public key, which every file is encrypted with. Only the public
 * key is ever uploaded: the private key stays with CIC. A new key must be
 * verified against the fingerprint CIC gives out of band before it can
 * encrypt; replacing or removing one needs a reason, and the old key is kept
 * in the history.
 */
export function PublicKeyCard({
  settings,
  onChange,
}: {
  settings: CicSettings;
  onChange: (settings: CicSettings) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const [removing, setRemoving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const key = settings.public_key;
  const expiresIn = key?.expires_at ? daysFromToday(key.expires_at) : null;

  /** The first key needs no reason; a replacement asks for one first. */
  const picked = (file: File) => {
    if (file.size > MAX_KEY_BYTES) {
      notifyWarning("That file is too large to be a public key.");
      return;
    }
    if (key) {
      setPending(file);
      return;
    }
    setUploading(true);
    cicService
      .uploadPublicKey(file)
      .then((public_key) => {
        notifySuccess("Key uploaded. Verify its fingerprint with CIC before it can encrypt.");
        onChange({ ...settings, public_key });
      })
      .catch((err) => notifyError(err, "The key could not be read. Upload the armored public key CIC sent (.asc)."))
      .then(() => setUploading(false));
  };

  const replace = async (reason: string) => {
    if (!pending) return;
    const public_key = await cicService.uploadPublicKey(pending, reason);
    notifySuccess("Key replaced. Verify the new fingerprint with CIC before it can encrypt.");
    setPending(null);
    setHistoryVersion((v) => v + 1);
    onChange({ ...settings, public_key });
  };

  const remove = async (reason: string) => {
    await cicService.removePublicKey(reason);
    notifySuccess("Public key removed.");
    setHistoryVersion((v) => v + 1);
    onChange({ ...settings, public_key: null });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Encryption Key</CardTitle>
        <CardDescription>
          The PGP public key CIC issued. Files are zipped and encrypted with it before download, so only CIC can
          open them.
        </CardDescription>
      </CardHeader>
      <CardContent className="max-w-2xl space-y-4">
        {key ? (
          <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <Badge variant={STATUS[key.status].variant}>{STATUS[key.status].label}</Badge>
            </dd>
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
            <dt className="text-muted-foreground">Verified</dt>
            <dd>
              {key.verified_at
                ? `${formatDateTime(key.verified_at)}${key.verified_by ? ` by ${key.verified_by}` : ""}`
                : "Not yet"}
            </dd>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No key yet. A file cannot be encrypted until one is uploaded.</p>
        )}
        {key && key.status === "unverified" && (
          <Alert>
            <AlertDescription>
              Files cannot be encrypted until this key is verified against the fingerprint CIC gives you directly.
            </AlertDescription>
          </Alert>
        )}
        {expiresIn !== null && expiresIn <= 30 && (
          <Alert variant={expiresIn < 0 ? "destructive" : "default"}>
            <AlertDescription>
              {expiresIn < 0
                ? "This key has expired, so files cannot be encrypted. Ask CIC for its new public key."
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
            if (file) picked(file);
          }}
        />
        <div className="flex flex-wrap gap-2">
          {key && key.status === "unverified" && <Button onClick={() => setVerifying(true)}>Verify Key</Button>}
          <Button variant={key ? "outline" : "default"} disabled={uploading} onClick={() => input.current?.click()}>
            {uploading ? "Uploading…" : key ? "Replace Key" : "Upload Key"}
          </Button>
          {key && (
            <Button variant="outline" onClick={() => setRemoving(true)}>
              Remove Key
            </Button>
          )}
        </div>
        <KeyHistory version={historyVersion} />
      </CardContent>

      {key && (
        <VerifyKeyDialog
          open={verifying}
          onOpenChange={setVerifying}
          publicKey={key}
          onVerified={(public_key) => onChange({ ...settings, public_key })}
        />
      )}
      <ReasonDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Replace CIC's Public Key"
        description={`Replace the current key with ${pending?.name ?? "the new file"}. The current key moves to the history, and the new one must be verified before it can encrypt.`}
        confirmLabel="Replace Key"
        onConfirm={replace}
      />
      <ReasonDialog
        open={removing}
        onOpenChange={setRemoving}
        title="Remove CIC's Public Key"
        description="No file can be encrypted until a new key is uploaded and verified. The key moves to the history."
        confirmLabel="Remove Key"
        destructive
        onConfirm={remove}
      />
    </Card>
  );
}
