"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { portalService } from "@/lib/portal/portal-api";
import { onUnreadChanged } from "@/lib/portal/unread";

/**
 * The bell: unread notices plus unread announcements, one server count
 * (`/portal/notifications/unread-count`), read again on every page change and
 * whenever the tab comes back into focus (portal design §7), and taken from
 * the server's new count as soon as a page marks something read. No websockets.
 */
export function NotificationBell() {
  const pathname = usePathname();
  const [total, setTotal] = useState(0);
  const [focusCount, setFocusCount] = useState(0);

  useEffect(() => {
    const onFocus = () => setFocusCount((n) => n + 1);
    window.addEventListener("focus", onFocus);
    const stop = onUnreadChanged((count) => setTotal(count.total));
    return () => {
      window.removeEventListener("focus", onFocus);
      stop();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    portalService
      .unreadCount()
      .then((count) => {
        if (!cancelled) setTotal(count.total);
      })
      .catch(() => {
        // The bell keeps its last count; a 401 ends the session elsewhere.
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, focusCount]);

  const label = total > 0 ? `Notifications, ${total} unread` : "Notifications";
  return (
    <Link
      href="/member/notifications"
      aria-label={label}
      className="relative inline-flex size-9 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Bell className="h-5 w-5" aria-hidden />
      {total > 0 && (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] rounded-full bg-destructive px-1 text-center text-[0.65rem] leading-[1.125rem] font-semibold text-white"
        >
          {total > 99 ? "99+" : total}
        </span>
      )}
    </Link>
  );
}
