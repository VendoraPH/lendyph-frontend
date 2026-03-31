"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SIDEBAR_NAV } from "@/constants";
import type { NavItem } from "@/constants/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUIStore } from "@/store/ui-store";

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const iconColors: Record<string, string> = {
  "/dashboard": "bg-brand-orange/15 text-brand-orange",
  "/users": "bg-purple-100 text-purple-600",
  "/borrowers": "bg-blue-100 text-blue-600",
  "/loans": "bg-green-100 text-green-600",
  "/payments": "bg-cyan-100 text-cyan-600",
  "/collections": "bg-amber-100 text-amber-600",
  "/reports": "bg-pink-100 text-pink-600",
  "/audit-trail": "bg-gray-100 text-gray-600",
  "/settings": "bg-slate-100 text-slate-600",
};

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
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

  const iconColorClass = iconColors[item.href] || "bg-gray-100 text-gray-600";

  // Collapsed mode: icon-only with tooltip
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center justify-center rounded-lg p-2 transition-colors",
                "hover:bg-sidebar-accent",
                (isActive || isChildActive) &&
                  "bg-brand-orange/10"
              )}
            />
          }
        >
          <span
            className={cn(
              "flex items-center justify-center rounded-lg h-8 w-8",
              iconColorClass
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">{item.title}</TooltipContent>
      </Tooltip>
    );
  }

  // Expanded mode: full nav with text labels
  if (!hasChildren) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-brand-orange/10 text-brand-orange font-semibold"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        )}
      >
        <span
          className={cn(
            "flex items-center justify-center rounded-lg h-8 w-8",
            iconColorClass
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
        </span>
        {item.title}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isOpen
            ? "bg-brand-orange/10 text-brand-orange font-semibold"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        )}
      >
        <span
          className={cn(
            "flex items-center justify-center rounded-lg h-8 w-8",
            iconColorClass
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
        </span>
        <span className="flex-1 text-left">{item.title}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>
      {expanded && (
        <div className="ml-7 mt-0.5 flex flex-col gap-0.5 border-l border-border/50 pl-3">
          {item.children!.map((child) => {
            const childActive =
              pathname === child.href ||
              pathname.startsWith(child.href + "/");

            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors",
                  childActive
                    ? "bg-brand-orange/10 text-brand-orange font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
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

function SidebarContent({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
        {/* Logo area */}
        <div
          className={cn(
            "flex flex-col border-b border-sidebar-border",
            collapsed ? "items-center px-2 py-4" : "gap-0.5 px-6 py-4"
          )}
        >
          {collapsed ? (
            <span className="text-xl font-bold text-brand-orange">L</span>
          ) : (
            <>
              <span className="text-xl font-bold text-brand-orange">
                Lendy.PH
              </span>
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Lending Management
              </span>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav
          className={cn(
            "flex-1 flex flex-col gap-0.5 overflow-y-auto",
            collapsed ? "items-center p-1.5" : "p-3"
          )}
        >
          {SIDEBAR_NAV.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </nav>

        {/* Collapse toggle (desktop only) */}
        {onToggle && (
          <div className="border-t border-sidebar-border">
            <button
              onClick={onToggle}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-3 text-sm text-muted-foreground transition-colors",
                "hover:bg-accent/50 hover:text-foreground",
                collapsed && "justify-center"
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4 shrink-0" />
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4 shrink-0" />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Footer (hidden when collapsed) */}
        {!collapsed && (
          <div className="border-t border-sidebar-border px-6 py-3">
            <span className="text-[11px] text-muted-foreground/60">
              v1.0.0
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebarCollapsed } = useUIStore();

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:block shrink-0 border-r border-sidebar-border min-h-screen sticky top-0 overflow-y-auto bg-sidebar transition-all duration-200 ease-in-out",
          sidebarCollapsed ? "w-14" : "w-64"
        )}
      >
        <SidebarContent
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebarCollapsed}
        />
      </aside>

      {/* Mobile drawer — always expanded */}
      <Sheet open={mobileOpen} onOpenChange={onMobileClose}>
        <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
          <SidebarContent collapsed={false} onNavigate={onMobileClose} />
        </SheetContent>
      </Sheet>
    </>
  );
}
