"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SIDEBAR_NAV } from "@/constants";
import type { NavItem } from "@/constants/navigation";
import { usePermission } from "@/hooks";
import { useRegistrations } from "@/hooks/use-registrations";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  GripVertical,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BrandLogo } from "@/components/common";
import { useUIStore } from "@/store/ui-store";
import { systemService } from "@/services";

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const MIN_WIDTH = 64;
const DEFAULT_WIDTH = 260;
const MAX_WIDTH = 600;

const iconColors: Record<string, string> = {
  "/dashboard": "bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-orange-200 dark:shadow-orange-900/30",
  "/users": "bg-gradient-to-br from-purple-400 to-purple-500 text-white shadow-purple-200 dark:shadow-purple-900/30",
  "/share-capital": "bg-gradient-to-br from-indigo-400 to-indigo-500 text-white shadow-indigo-200 dark:shadow-indigo-900/30",
  "/borrowers": "bg-gradient-to-br from-blue-400 to-blue-500 text-white shadow-blue-200 dark:shadow-blue-900/30",
  "/loans": "bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-emerald-200 dark:shadow-emerald-900/30",
  "/payments": "bg-gradient-to-br from-cyan-400 to-cyan-500 text-white shadow-cyan-200 dark:shadow-cyan-900/30",
  "/reports": "bg-gradient-to-br from-pink-400 to-pink-500 text-white shadow-pink-200 dark:shadow-pink-900/30",
  "/printables": "bg-gradient-to-br from-rose-400 to-rose-500 text-white shadow-rose-200 dark:shadow-rose-900/30",
  "/audit-trail": "bg-gradient-to-br from-gray-400 to-gray-500 text-white shadow-gray-200 dark:shadow-gray-900/30",
  "/settings": "bg-gradient-to-br from-slate-400 to-slate-500 text-white shadow-slate-200 dark:shadow-slate-900/30",
};

// ── Nav Link ──

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
  badge,
}: {
  item: NavItem;
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  badge?: number;
}) {
  const hasChildren = item.children && item.children.length > 0;
  const isExactMatch = pathname === item.href;
  const isPrefixMatch = pathname.startsWith(item.href + "/");
  // For items without children, active on exact or prefix match
  // For items with children, only used to expand — dot shown on child only
  const isActive = hasChildren ? false : (isExactMatch || isPrefixMatch);
  const isChildActive = hasChildren
    ? item.children!.some((c) => pathname === c.href)
    : false;
  const isOpen = isExactMatch || isPrefixMatch || isChildActive;
  const [expanded, setExpanded] = useState(isOpen);

  // Auto-expand when navigating to a child route
  useEffect(() => {
    if (isOpen) setExpanded(true);
  }, [isOpen]);
  const iconClass = iconColors[item.href] || "bg-gradient-to-br from-gray-400 to-gray-500 text-white";

  // ── Collapsed ──
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center justify-center rounded-2xl p-2 transition-all duration-200",
                "hover:bg-muted",
                (isActive || isChildActive) && "bg-brand-orange/8 ring-1 ring-brand-orange/20"
              )}
            />
          }
        >
          <span className={cn("flex items-center justify-center rounded-xl h-9 w-9 shadow-sm", iconClass)}>
            <item.icon className="h-4 w-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className={hasChildren ? "flex flex-col gap-1 p-2.5 min-w-[140px]" : undefined}>
          {hasChildren ? (
            <>
              <span className="font-semibold text-xs mb-1 text-foreground">{item.title}</span>
              {item.children!.map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onNavigate}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-accent",
                    pathname === child.href && "bg-brand-orange/10 text-brand-orange font-medium"
                  )}
                >
                  {child.title}
                </Link>
              ))}
            </>
          ) : (
            item.title
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  // ── Expanded no children ──
  if (!hasChildren) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
          isActive
            ? "bg-gradient-to-r from-brand-orange/10 to-brand-orange/5 text-brand-orange font-semibold shadow-sm ring-1 ring-brand-orange/10"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <span className={cn("flex items-center justify-center rounded-xl h-8 w-8 shadow-sm transition-transform duration-200 group-hover:scale-110", iconClass)}>
          <item.icon className="h-3.5 w-3.5" />
        </span>
        <span className="truncate">{item.title}</span>
        {badge && badge > 0 ? (
          <span className="ml-auto inline-flex items-center justify-center rounded-full bg-brand-orange px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
            {badge}
          </span>
        ) : isActive ? (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-orange animate-pulse" />
        ) : null}
      </Link>
    );
  }

  // ── Expanded with children ──
  return (
    <div>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
          isOpen
            ? "bg-gradient-to-r from-brand-orange/10 to-brand-orange/5 text-brand-orange font-semibold shadow-sm ring-1 ring-brand-orange/10"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <span className={cn("flex items-center justify-center rounded-xl h-8 w-8 shadow-sm transition-transform duration-200 group-hover:scale-110", iconClass)}>
          <item.icon className="h-3.5 w-3.5" />
        </span>
        <span className="flex-1 text-left truncate">{item.title}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-300", expanded && "rotate-180")} />
      </button>
      <div className={cn("overflow-hidden transition-all duration-300 ease-in-out", expanded ? "max-h-96 opacity-100 mt-1" : "max-h-0 opacity-0")}>
        <div className="ml-6 flex flex-col gap-0.5 border-l-2 border-brand-orange/15 pl-4">
          {item.children!.map((child) => {
            const childActive = pathname === child.href;
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  "relative rounded-xl px-3 py-1.5 text-[13px] transition-all duration-200",
                  childActive
                    ? "bg-brand-orange/8 text-brand-orange font-medium before:absolute before:-left-[18px] before:top-1/2 before:-translate-y-1/2 before:h-2 before:w-2 before:rounded-full before:bg-brand-orange"
                    : "text-muted-foreground/70 hover:bg-muted hover:text-foreground"
                )}
              >
                {child.title}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Sidebar Content ──

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
  const { can } = usePermission();
  // `per_page: 1` on purpose: this badge renders one integer off `meta.total`,
  // which is the count for the whole filtered query at any page size. Pulling
  // the default 100 BorrowerResource rows to read it also mints 100 signed
  // photo URLs on every page load.
  const { total: pendingRegistrationsCount } = useRegistrations({
    status: "pending",
    per_page: 1,
  });
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "down">("checking");

  useEffect(() => {
    let cancelled = false;
    let failures = 0;
    let interval: ReturnType<typeof setInterval> | null = null;

    const check = async () => {
      try {
        const res = await systemService.health();
        if (cancelled) return;
        failures = 0;
        setApiStatus(res?.status === "ok" ? "ok" : "down");
      } catch {
        if (cancelled) return;
        failures += 1;
        setApiStatus("down");
        // Circuit breaker: after 3 consecutive failures, stop polling so we
        // don't spam the network log when the backend health endpoint is down.
        if (failures >= 3 && interval) {
          clearInterval(interval);
          interval = null;
        }
      }
    };

    check();
    // 5 min — health is informational, no need to hammer the API.
    interval = setInterval(check, 5 * 60_000);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, []);

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className={cn(
          "flex h-14 items-center shrink-0 border-b border-border",
          collapsed ? "justify-center px-2" : "px-4"
        )}>
          {collapsed ? (
            <button
              onClick={onToggle}
              className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <BrandLogo className="h-6 w-auto object-contain" />
              </div>
              {onToggle && (
                <button
                  onClick={onToggle}
                  className="rounded-xl p-1.5 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-all"
                  title="Collapse sidebar"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 flex flex-col gap-0.5 overflow-y-auto scrollbar-thin",
          collapsed ? "items-center px-2 py-3" : "px-3 py-3"
        )}>
          {!collapsed && (
            <span className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
              Navigation
            </span>
          )}
          {SIDEBAR_NAV.filter((item) => can(item.permission)).map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onNavigate}
              badge={item.href === "/borrowers" ? pendingRegistrationsCount : undefined}
            />
          ))}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="border-t border-border px-5 py-2.5 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/50 font-medium">v1.0.0</span>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          apiStatus === "ok" && "bg-emerald-500",
                          apiStatus === "down" && "bg-red-500",
                          apiStatus === "checking" && "bg-muted-foreground/40 animate-pulse"
                        )}
                      />
                      API
                    </span>
                  }
                />
                <TooltipContent side="top">
                  {apiStatus === "ok" && "API healthy"}
                  {apiStatus === "down" && "API unreachable"}
                  {apiStatus === "checking" && "Checking API..."}
                </TooltipContent>
              </Tooltip>
              <span className="text-[10px] text-muted-foreground/50">© Lendy.PH</span>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// ── Resize Handle ──

function ResizeHandle({
  onResize,
  onResizeEnd,
}: {
  onResize: (deltaX: number) => void;
  onResizeEnd: () => void;
}) {
  const startXRef = useRef(0);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;
      isDragging.current = true;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = ev.clientX - startXRef.current;
        startXRef.current = ev.clientX;
        onResize(delta);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        onResizeEnd();
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [onResize, onResizeEnd]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize group z-10 flex items-center justify-center transition-colors hover:bg-brand-orange/10"
    >
      <div className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-brand-orange/20 p-0.5">
        <GripVertical className="h-3 w-3 text-brand-orange/50" />
      </div>
    </div>
  );
}

// ── Main Sidebar ──

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebarCollapsed } = useUIStore();
  const [customWidth, setCustomWidth] = useState(DEFAULT_WIDTH);
  const shouldCollapseRef = useRef(false);

  const handleResize = useCallback(
    (deltaX: number) => {
      if (sidebarCollapsed) return;
      setCustomWidth((prev) => {
        const next = prev + deltaX;
        if (next < MIN_WIDTH + 20) {
          shouldCollapseRef.current = true;
          return DEFAULT_WIDTH;
        }
        return Math.min(Math.max(next, MIN_WIDTH + 40), MAX_WIDTH);
      });
    },
    [sidebarCollapsed]
  );

  const handleResizeEnd = useCallback(() => {
    if (shouldCollapseRef.current) {
      shouldCollapseRef.current = false;
      toggleSidebarCollapsed();
    }
  }, [toggleSidebarCollapsed]);

  const sidebarWidth = sidebarCollapsed ? MIN_WIDTH : customWidth;

  return (
    <>
      {/* Desktop */}
      <aside
        className="hidden md:block shrink-0 min-h-screen sticky top-0 overflow-hidden bg-sidebar border-r border-sidebar-border transition-[width] duration-200 ease-in-out relative"
        style={{ width: sidebarWidth }}
      >
        <SidebarContent
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebarCollapsed}
        />
        {!sidebarCollapsed && (
          <ResizeHandle onResize={handleResize} onResizeEnd={handleResizeEnd} />
        )}
      </aside>

      {/* Mobile */}
      <Sheet open={mobileOpen} onOpenChange={onMobileClose}>
        <SheetContent side="left" className="w-72 p-0 border-0" showCloseButton={false}>
          <SidebarContent collapsed={false} onNavigate={onMobileClose} />
        </SheetContent>
      </Sheet>
    </>
  );
}
