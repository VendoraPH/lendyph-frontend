"use client";

import { useCallback, useState } from "react";
import { Pin, Plus } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { DataState } from "@/components/common/data-state";
import { TablePagination } from "@/components/common/table-pagination";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatDateTime } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { portalAdminService } from "@/services/portal-admin.service";
import type { PortalAnnouncement, PortalAnnouncementStatus } from "@/types/portal-admin";
import { usePortalResource } from "../../_hooks/use-portal-resource";
import { ANNOUNCEMENT_STATUS_LABELS, labelOf } from "../../_lib/labels";
import { audienceText } from "../../_lib/announcement-form";
import { notifyPortalError } from "../../_lib/notify-portal-error";
import { StateBadge } from "../../_components/state-badge";
import { AnnouncementDialog } from "./announcement-dialog";

const TABS: { value: "all" | PortalAnnouncementStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: ANNOUNCEMENT_STATUS_LABELS.draft },
  { value: "published", label: ANNOUNCEMENT_STATUS_LABELS.published },
  { value: "withdrawn", label: ANNOUNCEMENT_STATUS_LABELS.withdrawn },
];
const PER_PAGE = 25;

function statusBadge(a: PortalAnnouncement) {
  if (a.status === "published") {
    return a.live ? <StateBadge label="Showing now" tone="success" /> : <StateBadge label="Published, not showing" tone="info" />;
  }
  return <StateBadge label={labelOf(ANNOUNCEMENT_STATUS_LABELS, a.status)} tone={a.status === "draft" ? "warning" : "muted"} />;
}

/**
 * Announcements to members, for the caller's branches: write, edit, publish,
 * withdraw, and delete drafts. Adapted from #514 by Augustin.
 */
export function AnnouncementsScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{ announcement: PortalAnnouncement | null } | null>(null);
  const [deleting, setDeleting] = useState<PortalAnnouncement | null>(null);
  const { submitting, run } = useSubmitGuard();

  const fetcher = useCallback(
    () => portalAdminService.announcements({ page, status: tab === "all" ? undefined : tab }),
    [page, tab],
  );
  const resource = usePortalResource(fetcher);

  const act = (call: () => Promise<unknown>, done: string, after?: () => void) =>
    run(call)
      ?.then(() => {
        notifySuccess(done);
        after?.();
        resource.refetch();
      })
      .catch((err: unknown) => notifyPortalError(err, "The announcement couldn't be changed."));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portal Announcements</h1>
          <p className="text-sm text-muted-foreground">
            News for members in the portal. Members see an announcement from its start until it ends or is withdrawn.
          </p>
        </div>
        <Button onClick={() => setEditing({ announcement: null })}>
          <Plus className="h-4 w-4" aria-hidden /> New announcement
        </Button>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as typeof tab);
          setPage(1);
        }}
      >
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DataState
        resource={resource}
        endpoints={[]}
        summary="Announcements to members."
        isEmpty={(res) => res.data.length === 0}
        emptyMessage="No announcements here."
      >
        {(res) => (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Announcement</TableHead>
                    <TableHead>Who sees it</TableHead>
                    <TableHead className="hidden md:table-cell">Runs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Read by</TableHead>
                    <TableHead className="w-0">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {res.data.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <span className="flex items-center gap-1.5 font-medium">
                          {a.pinned && <Pin className="h-3.5 w-3.5 text-muted-foreground" aria-label="Pinned" />}
                          {a.title}
                        </span>
                        <span className="block max-w-72 truncate text-xs text-muted-foreground">{a.body}</span>
                      </TableCell>
                      <TableCell className="text-sm">{audienceText(a)}</TableCell>
                      <TableCell className="hidden whitespace-nowrap text-xs md:table-cell">
                        {a.publish_at ? formatDateTime(a.publish_at) : "When published"}
                        <span className="block text-muted-foreground">
                          {a.expires_at ? `until ${formatDateTime(a.expires_at)}` : "until withdrawn"}
                        </span>
                      </TableCell>
                      <TableCell>{statusBadge(a)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">{a.reads_count}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {a.status !== "withdrawn" && (
                            <Button size="sm" variant="ghost" disabled={submitting} onClick={() => setEditing({ announcement: a })}>
                              Edit
                            </Button>
                          )}
                          {a.status === "draft" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={submitting}
                                onClick={() => act(() => portalAdminService.publishAnnouncement(a.id), "Announcement published")}
                              >
                                Publish
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                disabled={submitting}
                                onClick={() => setDeleting(a)}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                          {a.status === "published" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={submitting}
                              onClick={() => act(() => portalAdminService.withdrawAnnouncement(a.id), "Announcement withdrawn")}
                            >
                              Withdraw
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              page={page}
              perPage={PER_PAGE}
              total={res.meta.total}
              perPageOptions={[PER_PAGE]}
              onPageChange={setPage}
              onPerPageChange={() => setPage(1)}
            />
          </div>
        )}
      </DataState>

      <AnnouncementDialog
        open={editing !== null}
        announcement={editing?.announcement ?? null}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={resource.refetch}
      />
      <ConfirmDeleteDialog
        open={deleting !== null}
        title="Delete this draft?"
        description={deleting ? `"${deleting.title}" was never published. It will be removed.` : null}
        busy={submitting}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) act(() => portalAdminService.deleteAnnouncement(deleting.id), "Draft deleted", () => setDeleting(null));
        }}
      />
    </div>
  );
}
