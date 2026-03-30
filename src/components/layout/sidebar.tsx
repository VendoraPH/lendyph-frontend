"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermission } from "@/hooks";
import { SIDEBAR_NAV } from "@/constants";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { can } = usePermission();
  const pathname = usePathname();

  const visibleItems = SIDEBAR_NAV.filter((item) => can(item.permission));

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b border-sidebar-border px-6">
        <span className="text-lg font-bold text-brand-blue">Lendyph</span>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive &&
                  "bg-sidebar-primary text-sidebar-primary-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
