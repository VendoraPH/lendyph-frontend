"use client";

import { useCallback, useEffect, useState } from "react";
import { Pin } from "lucide-react";
import { LoadState } from "@/components/portal/load-state";
import { PortalPageHeader } from "@/components/portal/page-header";
import { Pager } from "@/components/portal/pager";
import { formatDate } from "@/lib/format";
import { usePortalResource } from "@/lib/portal/hooks/use-portal-resource";
import { portalService } from "@/lib/portal/portal-api";
import type { Announcement } from "@/lib/portal/types";
import { onUnreadChanged, refreshUnread } from "@/lib/portal/unread";
import { cn } from "@/lib/utils";

/**
 * The cooperative's announcements for this member, pinned first. Opening one
 * marks it read on the server; the "not yet read" line and the bell then take
 * the server's new count.
 */
export default function AnnouncementsPage() {
  const [page, setPage] = useState(1);
  const [readNow, setReadNow] = useState<ReadonlySet<number>>(new Set());
  const fetcher = useCallback(() => portalService.announcements(page), [page]);
  const { data, loading, error, reload } = usePortalResource(fetcher, "We couldn't load the announcements. Please try again.");
  // The server's count after a read here; until then, the list's own `meta.unread`.
  const [unread, setUnread] = useState<number | null>(null);

  useEffect(() => onUnreadChanged((count) => setUnread(count.announcements)), []);

  const markRead = (item: Announcement) => {
    if (item.read_at || readNow.has(item.id)) return;
    portalService
      .readAnnouncement(item.id)
      .then(() => {
        setReadNow((prev) => new Set(prev).add(item.id));
        return refreshUnread();
      })
      .catch(() => undefined);
  };

  const notYetRead = unread ?? data?.meta.unread ?? 0;
  return (
    <>
      <PortalPageHeader title="Announcements" description={notYetRead > 0 ? `${notYetRead} not yet read` : undefined} />
      <LoadState loading={loading} error={error} onRetry={reload} empty={data?.data.length === 0} emptyText="No announcements right now.">
        {data && (
          <>
            <ul className="space-y-3">
              {data.data.map((item) => {
                const isUnread = !item.read_at && !readNow.has(item.id);
                return (
                  <li key={item.id}>
                    <details
                      className={cn("group rounded-lg border bg-card", isUnread && "border-l-4 border-l-brand-orange")}
                      onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && markRead(item)}
                    >
                      <summary className="flex cursor-pointer list-none items-start gap-2 p-3 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        {item.pinned && <Pin className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" aria-label="Pinned" />}
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium break-words">
                            {item.title}
                            {isUnread && <span className="sr-only"> (unread)</span>}
                          </span>
                          {item.publish_at && <span className="block text-xs text-muted-foreground">{formatDate(item.publish_at)}</span>}
                        </span>
                        <span className="text-xs text-primary group-open:hidden">Read</span>
                      </summary>
                      <p className="px-3 pb-3 text-sm whitespace-pre-line break-words">{item.body}</p>
                    </details>
                  </li>
                );
              })}
            </ul>
            <Pager meta={data.meta} onPage={setPage} />
          </>
        )}
      </LoadState>
    </>
  );
}
