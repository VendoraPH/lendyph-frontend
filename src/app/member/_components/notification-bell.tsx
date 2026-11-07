"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { portalService } from "@/services/portal.service";

/** Fired by the notifications page after marking something read. */
export const NOTIFICATIONS_CHANGED_EVENT = "portal:notifications-changed";

export function announceNotificationsChanged(): void {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

/** The bell in the top bar with the unread count; re-read on every page change. */
export function NotificationBell() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    const onChanged = () => setBump((n) => n + 1);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
  }, []);

  useEffect(() => {
    let live = true;
    portalService
      .unreadCount()
      .then((r) => live && setCount(Math.max(0, Number(r?.count) || 0)))
      .catch(() => {
        // Not built yet, or offline: a bell without a number is enough.
        if (live) setCount(0);
      });
    return () => {
      live = false;
    };
  }, [pathname, bump]);

  const label = count > 0 ? `Notifications, ${count} unread` : "Notifications";
  return (
    <Link
      href="/member/notifications"
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
        pathname.startsWith("/member/notifications") && "bg-muted text-foreground",
      )}
    >
      <Bell className="h-4 w-4" aria-hidden />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-brand-orange px-1 text-center text-[10px] font-semibold leading-4 text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
