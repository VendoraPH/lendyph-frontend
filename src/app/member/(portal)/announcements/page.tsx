"use client";

import { useCallback, useMemo } from "react";
import { Pin } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatDate } from "@/lib/format";
import { portalService } from "@/services/portal.service";
import type { PortalAnnouncement } from "@/types/portal";
import { PortalPageHeader } from "../../_components/portal-shell";

/** Notices the cooperative published for this member's audience. */
export default function MemberAnnouncementsPage() {
  const fetcher = useCallback(() => portalService.announcements(), []);
  const resource = useApiResource(fetcher);

  return (
    <>
      <PortalPageHeader title="Announcements" description="News and notices from the cooperative." />
      <DataState
        resource={resource}
        endpoints={["GET /portal/announcements"]}
        summary="Announcements from the cooperative will show here once online access is connected."
        isEmpty={(rows) => rows.length === 0}
        emptyMessage="There are no announcements right now."
      >
        {(rows) => <AnnouncementList rows={rows} />}
      </DataState>
    </>
  );
}

function AnnouncementList({ rows }: { rows: PortalAnnouncement[] }) {
  // Pinned first, then newest.
  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) => Number(b.pinned) - Number(a.pinned) || b.published_at.localeCompare(a.published_at),
      ),
    [rows],
  );
  return (
    <div className="space-y-3">
      {sorted.map((a) => (
        <Card key={a.id} id={`announcement-${a.id}`}>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-start gap-2">
              {a.pinned && <Pin className="mt-1 h-4 w-4 shrink-0 text-brand-orange" aria-label="Pinned" />}
              <h2 className="flex-1 font-semibold">{a.title}</h2>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDate(a.published_at)}</span>
            </div>
            {/* Plain text from staff: whitespace kept, never rendered as HTML. */}
            <p className="whitespace-pre-line text-sm">{a.body}</p>
            {a.expires_at && (
              <p className="text-xs text-muted-foreground">Until {formatDate(a.expires_at)}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
