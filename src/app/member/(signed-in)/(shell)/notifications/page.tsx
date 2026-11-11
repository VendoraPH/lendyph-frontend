"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { LoadState } from "@/components/portal/load-state";
import { PortalPageHeader } from "@/components/portal/page-header";
import { Pager } from "@/components/portal/pager";
import { StatusPill } from "@/components/portal/status-pill";
import { formatDateTime } from "@/lib/format";
import { useConfirmedSubmit } from "@/lib/portal/hooks/use-confirmed-submit";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { NOTIFICATION_CATEGORY } from "@/lib/portal/labels";
import { portalService } from "@/lib/portal/portal-api";
import { CONFIRMS } from "@/lib/portal/server-confirm";
import type { PortalNotification } from "@/lib/portal/types";
import { refreshUnread } from "@/lib/portal/unread";
import { safeMemberLink } from "@/lib/portal/words";
import { cn } from "@/lib/utils";

/**
 * The member's in-app notices (no SMS or email). A notice's link is followed
 * only when it stays inside the member portal (`safeMemberLink`).
 */
export default function NotificationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const fetcher = useCallback(() => portalService.notifications(page, unreadOnly), [page, unreadOnly]);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load your notifications. Please try again.");
  const { submitting, submit } = useConfirmedSubmit();

  const open = (notice: PortalNotification) => {
    const link = safeMemberLink(notice.link);
    const read = notice.read_at
      ? Promise.resolve()
      : portalService.readNotification(notice.id).then(() => refreshUnread().then(() => undefined));
    read
      .catch(() => undefined)
      .then(() => {
        if (link) router.push(link);
        else reload();
      });
  };

  const readAll = () =>
    submit(() => portalService.readAllNotifications(), {
      expect: CONFIRMS.done,
      success: "All notifications marked as read",
      failure: "We couldn't mark them as read. Please try again.",
      onConfirmed: () => {
        reload();
        void refreshUnread();
      },
    });

  const show = (only: boolean) => {
    setPage(1);
    setUnreadOnly(only);
  };

  return (
    <>
      <PortalPageHeader
        title="Notifications"
        actions={
          <Button variant="outline" size="sm" onClick={readAll} disabled={submitting}>
            {submitting && <Spinner className="h-4 w-4" />}
            Mark all as read
          </Button>
        }
      />
      <div className="mb-4 flex gap-2" role="group" aria-label="Show">
        <Button size="sm" variant={unreadOnly ? "outline" : "secondary"} aria-pressed={!unreadOnly} onClick={() => show(false)}>
          All
        </Button>
        <Button size="sm" variant={unreadOnly ? "secondary" : "outline"} aria-pressed={unreadOnly} onClick={() => show(true)}>
          Unread
        </Button>
      </div>
      <LoadState loading={loading} error={error} onRetry={reload} empty={data?.data.length === 0} emptyText="No notifications.">
        {data && (
          <>
            <ul className="space-y-2">
              {data.data.map((notice) => (
                <li key={notice.id}>
                  <button
                    type="button"
                    onClick={() => open(notice)}
                    className={cn(
                      "w-full rounded-lg border bg-card p-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      !notice.read_at && "border-l-4 border-l-brand-orange",
                    )}
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {notice.title}
                        {!notice.read_at && <span className="sr-only"> (unread)</span>}
                      </span>
                      <StatusPill value={notice.category} labels={NOTIFICATION_CATEGORY} />
                    </span>
                    {notice.body && <span className="mt-1 block text-sm text-muted-foreground">{notice.body}</span>}
                    <span className="mt-1 block text-xs text-muted-foreground">{formatDateTime(notice.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <Pager meta={data.meta} onPage={setPage} />
          </>
        )}
      </LoadState>
      <p className="mt-6 text-xs text-muted-foreground">
        Announcements from your cooperative are on the{" "}
        <Link href="/member/announcements" className="underline">
          Announcements
        </Link>{" "}
        page.
      </p>
    </>
  );
}
