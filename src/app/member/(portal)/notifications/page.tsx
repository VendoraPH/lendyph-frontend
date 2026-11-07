"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, Settings2 } from "lucide-react";
import { TablePagination } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatDateTime } from "@/lib/format";
import { notifyError } from "@/lib/notify";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_FILTERS, safePortalLink } from "@/lib/portal/engagement";
import { cn } from "@/lib/utils";
import { portalService } from "@/services/portal.service";
import type { NotificationCategory, PortalNotification } from "@/types/portal";
import { announceNotificationsChanged } from "../../_components/notification-bell";
import { PortalPageHeader } from "../../_components/portal-shell";

export default function MemberNotificationsPage() {
  const [category, setCategory] = useState<NotificationCategory | "all">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const fetcher = useCallback(
    () =>
      portalService.notifications({
        page,
        per_page: perPage,
        category: category === "all" ? undefined : category,
        unread: unreadOnly ? 1 : undefined,
      }),
    [page, perPage, category, unreadOnly],
  );
  const resource = useApiResource(fetcher);

  const markAll = () => {
    portalService
      .markAllRead()
      .then(() => {
        announceNotificationsChanged();
        resource.refetch();
      })
      .catch((err) => notifyError(err, "Could not mark your notifications as read."));
  };

  const choose = (c: NotificationCategory | "all") => {
    setCategory(c);
    setPage(1);
  };

  return (
    <>
      <PortalPageHeader
        title="Notifications"
        description="Updates on your loans, payments, savings and requests."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={markAll} disabled={resource.unavailable}>
              <CheckCheck className="mr-1.5 h-4 w-4" /> Mark all as read
            </Button>
            <Link
              href="/member/notifications/preferences"
              className="inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
            >
              <Settings2 className="mr-1.5 h-4 w-4" /> Preferences
            </Link>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Category" className="flex flex-wrap gap-1.5">
          {(["all", ...NOTIFICATION_FILTERS] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={category === c}
              onClick={() => choose(c)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                category === c ? "border-brand-orange bg-brand-orange/10 text-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {c === "all" ? "All" : NOTIFICATION_CATEGORIES[c]}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Switch
            id="unread-only"
            checked={unreadOnly}
            onCheckedChange={(v) => {
              setUnreadOnly(v);
              setPage(1);
            }}
          />
          <Label htmlFor="unread-only">Unread only</Label>
        </div>
      </div>
      <DataState
        resource={resource}
        endpoints={[
          "GET /portal/notifications",
          "POST /portal/notifications/{id}/read",
          "POST /portal/notifications/read-all",
        ]}
        summary="Your notifications will show here once online access is connected."
        isEmpty={(body) => body.data.length === 0}
        emptyMessage={unreadOnly ? "You are all caught up." : "No notifications yet."}
      >
        {(body) => (
          <div className="space-y-3">
            <Card>
              <CardContent className="divide-y p-0">
                {body.data.map((n) => (
                  // Keyed on read_at too, so "mark all as read" redraws each row.
                  <NotificationRow key={`${n.id}-${n.read_at ?? ""}`} notification={n} />
                ))}
              </CardContent>
            </Card>
            <TablePagination
              page={page}
              perPage={perPage}
              total={body.meta?.total ?? body.data.length}
              onPageChange={setPage}
              onPerPageChange={(n) => {
                setPerPage(n);
                setPage(1);
              }}
            />
          </div>
        )}
      </DataState>
    </>
  );
}

function NotificationRow({ notification }: { notification: PortalNotification }) {
  const router = useRouter();
  const [read, setRead] = useState(notification.read_at !== null);
  const link = safePortalLink(notification.link);

  const open = () => {
    if (!read) {
      setRead(true);
      portalService
        .markRead(notification.id)
        .then(announceNotificationsChanged)
        .catch(() => setRead(false));
    }
    if (link) router.push(link);
  };

  return (
    <button
      type="button"
      onClick={open}
      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50"
    >
      <span
        aria-hidden
        className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", read ? "bg-transparent" : "bg-brand-orange")}
      />
      <span className="min-w-0 flex-1">
        <span className={cn("block", !read && "font-semibold")}>
          {notification.title}
          {!read && <span className="sr-only"> (unread)</span>}
        </span>
        <span className="block text-sm text-muted-foreground">{notification.body}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {NOTIFICATION_CATEGORIES[notification.category] ?? "Other"} · {formatDateTime(notification.created_at)}
        </span>
      </span>
    </button>
  );
}
