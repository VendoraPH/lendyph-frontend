"use client";

import { useCallback, useState } from "react";
import { Pin, Plus } from "lucide-react";
import { TablePagination } from "@/components/common";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { ANNOUNCEMENT_STATUS, AUDIENCE_LABELS } from "@/lib/portal/engagement";
import { humanize, TONE_CLASS } from "@/lib/portal/labels";
import { portalAdminService } from "@/services/portal-admin.service";
import type { AnnouncementStatus, StaffAnnouncement } from "@/types/portal";
import { AnnouncementDialog } from "./announcement-dialog";

/** Notices staff publish to members' portals, to everyone or a chosen audience. */
export function AnnouncementsScreen() {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [status, setStatus] = useState<AnnouncementStatus | "">("");
  // undefined = closed, null = new, otherwise editing that one.
  const [editing, setEditing] = useState<StaffAnnouncement | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<StaffAnnouncement | null>(null);
  const [busy, setBusy] = useState(false);

  const fetcher = useCallback(
    () => portalAdminService.announcements({ page, per_page: perPage, status: status || undefined }),
    [page, perPage, status],
  );
  const resource = useApiResource(fetcher);
  const rows = resource.data?.data ?? [];
  const total = resource.data?.meta?.total ?? rows.length;

  const remove = () => {
    if (!deleting) return;
    setBusy(true);
    portalAdminService
      .deleteAnnouncement(deleting.id)
      .then(() => {
        notifySuccess("Announcement deleted");
        setDeleting(null);
        resource.refetch();
      })
      .catch((err) => notifyError(err, "The announcement could not be deleted."))
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Portal Announcements</h1>
          <p className="text-sm text-muted-foreground">
            News and notices shown in members&apos; portals. Members in the audience are also notified.
          </p>
        </div>
        <Button onClick={() => setEditing(null)} disabled={resource.unavailable}>
          <Plus className="mr-2 h-4 w-4" /> New announcement
        </Button>
      </div>

      <div className="space-y-3">
        <NativeSelect
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as AnnouncementStatus | "");
            setPage(1);
          }}
        >
          <NativeSelectOption value="">All statuses</NativeSelectOption>
          {(Object.keys(ANNOUNCEMENT_STATUS) as AnnouncementStatus[]).map((s) => (
            <NativeSelectOption key={s} value={s}>
              {ANNOUNCEMENT_STATUS[s].label}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        {resource.unavailable && (
          <p className="text-sm text-muted-foreground">
            Announcements are not connected yet (GET /portal-admin/announcements).
          </p>
        )}
        {resource.error && <p className="text-sm text-destructive">{resource.error}</p>}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Announcement</TableHead>
                <TableHead className="hidden md:table-cell">Audience</TableHead>
                <TableHead className="hidden md:table-cell">Publish</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    {resource.loading ? "Loading announcements…" : "No announcements yet."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((a) => {
                  const st = ANNOUNCEMENT_STATUS[a.status] ?? { label: humanize(a.status), tone: "muted" as const };
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <p className="flex items-center gap-1.5 font-medium">
                          {a.pinned && <Pin className="h-3.5 w-3.5 text-brand-orange" aria-label="Pinned" />}
                          {a.title}
                        </p>
                        <p className="line-clamp-1 max-w-md text-xs text-muted-foreground">{a.body}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {AUDIENCE_LABELS[a.audience] ?? humanize(a.audience)}
                        {a.recipients !== null && (
                          <p className="text-xs text-muted-foreground">{a.recipients} members</p>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {a.published_at ? formatDateTime(a.published_at) : "—"}
                        {a.expires_at && (
                          <p className="text-xs text-muted-foreground">Until {formatDateTime(a.expires_at)}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[st.tone]}`}>
                          {st.label}
                        </span>
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => setEditing(a)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(a)}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <TablePagination
          page={page}
          perPage={perPage}
          total={total}
          onPageChange={setPage}
          onPerPageChange={(n) => {
            setPerPage(n);
            setPage(1);
          }}
        />
      </div>

      <AnnouncementDialog
        open={editing !== undefined}
        announcement={editing ?? null}
        onOpenChange={(open) => !open && setEditing(undefined)}
        onSaved={resource.refetch}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleting?.title}&rdquo; is removed from every member&apos;s portal. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={busy}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
