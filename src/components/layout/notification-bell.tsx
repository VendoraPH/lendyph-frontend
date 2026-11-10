"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Info,
  RefreshCw,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateTime } from "@/lib/format";
import {
  bellAccessibleName,
  bellOwnerKey,
  buildFeed,
  unreadBadgeLabel,
  type NotificationFeedItem,
  type NotificationTone,
} from "@/lib/notification-feed";
import { useNotificationBell } from "./use-notification-bell";

const TONE: Record<NotificationTone, { icon: LucideIcon; className: string }> = {
  approval: { icon: ClipboardCheck, className: "bg-brand-orange/10 text-brand-orange" },
  success: { icon: CircleCheck, className: "bg-green-500/10 text-green-700 dark:text-green-400" },
  danger: { icon: CircleX, className: "bg-red-500/10 text-red-600 dark:text-red-400" },
  warning: { icon: TriangleAlert, className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  info: { icon: Info, className: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
};

function FeedRow({ item, onOpen }: { item: NotificationFeedItem; onOpen: (item: NotificationFeedItem) => void }) {
  const tone = TONE[item.tone];
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none ${
          item.unread ? "bg-brand-orange/5" : ""
        }`}
      >
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone.className}`}>
          <tone.icon className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{item.kind}: </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span className={`line-clamp-2 break-words text-sm ${item.unread ? "font-semibold" : "font-medium"}`}>
              {item.title}
            </span>
            {item.unread && (
              <>
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" aria-hidden="true" />
                <span className="sr-only">Unread</span>
              </>
            )}
          </span>
          {item.body && (
            <span className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">{item.body}</span>
          )}
          {item.relativeTime && (
            <time
              dateTime={item.createdAt}
              title={formatDateTime(item.createdAt)}
              className="mt-1 block text-[10px] text-muted-foreground/70"
            >
              {item.relativeTime}
            </time>
          )}
        </span>
      </button>
    </li>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-1 py-2" aria-busy="true" aria-label="Loading notifications">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-2">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The header bell: the unread badge (polled), and a popover with the latest
 * 20 notifications, unread first. Title and body show exactly what the server
 * wrote, ₱ amounts included. Opening a row marks it read and goes to its page.
 *
 * Keyed on the signed-in user, so signing out or switching user starts from
 * an empty bell rather than the previous user's count and list.
 */
export function NotificationBell() {
  const { user } = useAuth();
  return <NotificationBellPanel key={bellOwnerKey(user)} enabled={Boolean(user)} />;
}

function NotificationBellPanel({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const bell = useNotificationBell(enabled);
  const [open, setOpen] = useState(false);
  const feed = useMemo(() => buildFeed(bell.rows, bell.loadedAt), [bell.rows, bell.loadedAt]);
  const badge = unreadBadgeLabel(bell.count);
  const hasUnread = (bell.count ?? 0) > 0 || feed.some((item) => item.unread);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) bell.loadList();
  };

  const openItem = (item: NotificationFeedItem) => {
    if (item.unread) bell.markRead(item.id);
    if (item.href) {
      setOpen(false);
      router.push(item.href);
    }
  };

  let body: ReactNode;
  if (bell.status === "error") {
    body = (
      <div role="alert" className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center text-muted-foreground">
        <p className="text-sm">Couldn&apos;t load notifications.</p>
        <Button variant="outline" size="sm" onClick={bell.loadList}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </Button>
      </div>
    );
  } else if (bell.status !== "ready") {
    body = <FeedSkeleton />;
  } else if (feed.length === 0) {
    body = (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Bell className="mb-2 h-8 w-8 opacity-40" aria-hidden="true" />
        <p className="text-sm">No notifications yet</p>
      </div>
    );
  } else {
    body = (
      <ul className="divide-y divide-border/60">
        {feed.map((item) => (
          <FeedRow key={item.id} item={item} onOpen={openItem} />
        ))}
      </ul>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative rounded-full text-muted-foreground hover:bg-muted/50"
          />
        }
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {badge && (
          <span
            key={badge}
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 animate-in zoom-in-50 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white duration-200"
          >
            {badge}
          </span>
        )}
        <span className="sr-only">{bellAccessibleName(bell.count)}</span>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(20rem,calc(100vw-1rem))] gap-0 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {hasUnread && (
            <button
              type="button"
              onClick={bell.markAll}
              className="rounded-sm text-xs font-medium text-brand-orange outline-none transition-colors hover:text-brand-orange-dark focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Mark all as read
            </button>
          )}
        </div>
        <div className="max-h-[min(24rem,70vh)] overflow-y-auto">{body}</div>
      </PopoverContent>
    </Popover>
  );
}
