"use client";

import { useState } from "react";
import { DataState } from "@/components/common/data-state";
import { ReasonDialog } from "@/components/common/reason-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { formatDate, formatDateTime } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { cicService } from "@/services";
import type { CicKeyStatus, CicPublicKey } from "@/types/cic";
import { KEY_STATUS_LABELS, whenBy } from "@/app/(app)/cic/_lib/labels";
import { UploadKeyDialog } from "./upload-key-dialog";
import { VerifyKeyDialog } from "./verify-key-dialog";

const VARIANT: Record<CicKeyStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  pending: "secondary",
  retired: "outline",
};

function KeyRow({ k, onVerify, onRetire }: { k: CicPublicKey; onVerify: () => void; onRetire: () => void }) {
  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <Badge variant={k.expired && k.status !== "retired" ? "destructive" : VARIANT[k.status]}>
          {k.expired && k.status !== "retired" ? "Expired" : KEY_STATUS_LABELS[k.status]}
        </Badge>
      </TableCell>
      <TableCell className="max-w-64 whitespace-normal">
        <span className="break-all font-mono text-xs">{k.fingerprint_display}</span>
        <span className="block text-xs text-muted-foreground">
          {[k.algorithm, k.user_ids.join(", ")].filter(Boolean).join(" · ")}
        </span>
      </TableCell>
      <TableCell>{k.expires_at ? formatDate(k.expires_at) : "Never"}</TableCell>
      <TableCell className="whitespace-normal text-sm">
        <span className="block">Uploaded {whenBy(k.uploaded_at, k.uploaded_by, formatDateTime)}</span>
        {k.verified_at && <span className="block">Verified {whenBy(k.verified_at, k.verified_by, formatDateTime)}</span>}
        {k.retired_at && (
          <span className="block">
            Retired {whenBy(k.retired_at, k.retired_by, formatDateTime)}
            {k.retire_reason ? `: ${k.retire_reason}` : ""}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          {k.can_verify && <Button onClick={onVerify}>Verify</Button>}
          {k.status !== "retired" && (
            <Button variant="outline" onClick={onRetire}>
              Retire
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * CIC's public keys. Every file is encrypted with the active one. A new key is
 * verified by a second person before it encrypts; retiring one takes a
 * reason. Nothing is deleted, so the list is the key history.
 */
export function PublicKeyCard() {
  const keys = useApiResource(cicService.listPublicKeys);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState<CicPublicKey | null>(null);
  const [retiring, setRetiring] = useState<CicPublicKey | null>(null);
  // After an upload, verify or retire, the list is read again from the server.
  const refresh = keys.refetch;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle className="text-base">CIC&apos;s Public Key</CardTitle>
          <CardDescription>
            The server zips each file and encrypts it with the active key, so only CIC can open it. Only CIC&apos;s
            public key is ever uploaded.
          </CardDescription>
        </div>
        <Button onClick={() => setUploading(true)}>Upload Key</Button>
      </CardHeader>
      <CardContent>
        <DataState
          resource={keys}
          summary="CIC's public keys: the active one, any waiting for verification, and those retired."
          endpoints={["GET /cic/public-keys"]}
          isEmpty={(rows) => rows.length === 0}
          emptyMessage="No key yet. A file can't be encrypted until CIC's key is uploaded and verified."
        >
          {(rows) => (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Fingerprint</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>History</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((k) => (
                    <KeyRow key={k.id} k={k} onVerify={() => setVerifying(k)} onRetire={() => setRetiring(k)} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DataState>
      </CardContent>
      <UploadKeyDialog open={uploading} onOpenChange={setUploading} onUploaded={refresh} />
      <VerifyKeyDialog publicKey={verifying} onOpenChange={(open) => !open && setVerifying(null)} onVerified={refresh} />
      <ReasonDialog
        open={retiring !== null}
        onOpenChange={(open) => !open && setRetiring(null)}
        title="Retire CIC's Public Key"
        description={
          retiring?.status === "active"
            ? "No file can be encrypted until another key is verified. The key stays in the history."
            : "The key stays in the history and can't be verified or used."
        }
        confirmLabel="Retire Key"
        destructive
        onConfirm={async (reason) => {
          if (!retiring) return;
          await cicService.retirePublicKey(retiring.id, reason);
          notifySuccess("Key retired.");
          refresh();
        }}
      />
    </Card>
  );
}
