"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SIDEBAR_NAV } from "@/constants";
import type { NavItem } from "@/constants/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const hasChildren = item.children && item.children.length > 0;
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/");
  const isChildActive = hasChildren
    ? item.children!.some(
        (child) =>
          pathname === child.href || pathname.startsWith(child.href + "/")
      )
    : false;
  const isOpen = isActive || isChildActive;

  const [expanded, setExpanded] = useState(isOpen);

  if (!hasChildren) {
    return (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive && "bg-sidebar-primary text-sidebar-primary-foreground"
        )}
      >
        <item.icon className="h-4 w-4" />
        {item.title}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isOpen && "text-sidebar-primary-foreground"
        )}
      >
        <item.icon className="h-4 w-4" />
        <span className="flex-1 text-left">{item.title}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>
      {expanded && (
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
          {item.children!.map((child) => {
            const childActive =
              pathname === child.href ||
              pathname.startsWith(child.href + "/");

            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  childActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground/70"
                )}
              >
                {child.title}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b border-sidebar-border px-6">
        <span className="text-lg font-bold text-brand-orange">Lendy.PH</span>
      </div>
      <nav className="flex flex-col gap-0.5 p-3">
        {SIDEBAR_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
    </aside>
  );
}
