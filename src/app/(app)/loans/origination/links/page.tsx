"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { Copy, Pencil, Plus, QrCode } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { DisabledReason } from "@/components/common/disabled-reason";
import { ScrollBox } from "@/components/common/page-fill";
import { PermissionButton } from "@/components/common/permission-button";
import { TestBadge, ToneBadge } from "@/components/loan-origination/badges";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { formatDate } from "@/lib/format";
import { emptyArt } from "@/lib/illustrations";
import { notifyError, notifySuccess } from "@/lib/notify";
import { FIT_CLASSES } from "@/lib/page-fill";
import { cn } from "@/lib/utils";
import { loanOriginationService } from "@/services";
import type { ApplicationLink } from "@/types/loan-origination";
import { NO_ADDRESS } from "../_lib/links";
import { LinkFormDialog } from "./_components/link-form-dialog";

const copy = (url: string) =>
  navigator.clipboard
    .writeText(url)
    .then(() => notifySuccess("Link copied"))
    .catch((err) => notifyError(err, "Could not copy the link"));

/**
 * Shareable public links that open the online application, each with its own
 * QR code. The server builds each link's address; while its public address
 * isn't set up a link has none, and the page says so instead of copying.
 */
export default function ApplicationLinksPage() {
  const links = useApiResource(loanOriginationService.listLinks);
  const [editing, setEditing] = useState<{ link: ApplicationLink | null } | null>(null);
  const [qr, setQr] = useState<(ApplicationLink & { url: string }) | null>(null);

  return (
    <div className={cn(FIT_CLASSES.section, "gap-3")}>
      <div className="flex justify-end">
        <PermissionButton permission="loan_origination:settings" size="sm" onClick={() => setEditing({ link: null })}>
          <Plus className="mr-1 h-4 w-4" /> New link
        </PermissionButton>
      </div>
      <DataState
        resource={links}
        summary="Public application links, with QR codes for posters and social media, will be managed here once online applications are connected."
        endpoints={["GET /loan-origination/links"]}
        isEmpty={(rows) => rows.length === 0}
        emptyMessage="No application links yet. Create one to start taking applications online."
        emptyIllustration={emptyArt("emptyDocuments", false)}
      >
        {(rows) => (
          <div className={cn("rounded-xl border bg-card", FIT_CLASSES.section)}>
            <ScrollBox>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Link</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead className="text-right">Started</TableHead>
                    <TableHead className="text-right">Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="min-w-48">
                        <span className="font-medium">{l.name}</span>
                        {l.is_test && <span className="ml-1"><TestBadge /></span>}
                        <span className="block max-w-72 truncate text-xs text-muted-foreground" title={l.url ?? NO_ADDRESS}>
                          {l.url ?? "No link to share yet"}
                        </span>
                      </TableCell>
                      <TableCell>{l.branch_name ?? "Every branch"}</TableCell>
                      <TableCell className="max-w-56 text-sm">
                        {l.loan_product_names.length ? l.loan_product_names.join(", ") : "All online products"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.visits}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.started}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.submitted}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <ToneBadge tone={l.status === "active" ? "success" : "neutral"}>{l.status_label}</ToneBadge>
                        {l.expires_at && (
                          <span className="block text-xs text-muted-foreground">until {formatDate(l.expires_at)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <DisabledReason reason={l.url === null ? NO_ADDRESS : null}>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Copy ${l.name}`}
                              disabled={l.url === null}
                              onClick={() => l.url && copy(l.url)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </DisabledReason>
                          <DisabledReason reason={l.url === null ? NO_ADDRESS : null}>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`QR code for ${l.name}`}
                              disabled={l.url === null}
                              onClick={() => l.url && setQr({ ...l, url: l.url })}
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                          </DisabledReason>
                          <PermissionButton
                            permission="loan_origination:settings"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Edit ${l.name}`}
                            onClick={() => setEditing({ link: l })}
                          >
                            <Pencil className="h-4 w-4" />
                          </PermissionButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollBox>
          </div>
        )}
      </DataState>

      <LinkFormDialog
        link={editing?.link ?? null}
        open={editing !== null}
        onOpenChange={(next) => !next && setEditing(null)}
        onDone={links.refetch}
      />
      <Dialog open={qr !== null} onOpenChange={(next) => !next && setQr(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{qr?.name}</DialogTitle>
          </DialogHeader>
          {qr && (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-lg bg-white p-4">
                <QRCode value={qr.url} size={200} />
              </div>
              <p className="break-all text-center text-xs text-muted-foreground">{qr.url}</p>
              <Button size="sm" variant="outline" onClick={() => copy(qr.url)}>
                <Copy className="mr-1 h-4 w-4" /> Copy link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
