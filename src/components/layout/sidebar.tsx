"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SIDEBAR_NAV } from "@/constants";
import { LINDA_NAV, navChildAllowed, navItemAllowed, navItemHref, type NavItem } from "@/constants/navigation";
import { usePermission } from "@/hooks";
import { useRegistrations } from "@/hooks/use-registrations";
import {
  pendingApprovalsBadgeEnabled,
  usePendingLoanApprovals,
} from "@/hooks/use-pending-loan-approvals";
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
import { Icon3D } from "@/components/common/icon-3d";
import { ICON_3D_TILE_CLASS } from "@/lib/icons-3d";
import { LindaAvatar } from "@/components/linda/linda-avatar";
import { selectSidebarCollapsed, useUIStore } from "@/store/ui-store";
import { systemService } from "@/services";
import { collapsedNavLabel, countLabel, newLabel } from "./sidebar-labels";
import { useUnseenNavBadges } from "./use-unseen-nav-badges";

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const MIN_WIDTH = 64;
const DEFAULT_WIDTH = 260;
const MAX_WIDTH = 600;

/** GCash, which keeps its own brand mark, still sits on today's grey tile. */
const LINE_ICON_TILE = "bg-gradient-to-br from-gray-400 to-gray-500 text-white";

/**
 * An item's icon on its tile: the 3D icon on the soft neutral tile, Linda's
 * face on the same tile (as on her floating button), or, for GCash, its own
 * mark on the grey tile. The tile keeps today's size (36px collapsed, 32px
 * open), so nothing in the menu moves.
 */
function NavItemIcon({ item, collapsed, className, children }: {
  item: NavItem;
  collapsed?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const isLinda = item.href === LINDA_NAV.href;
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-xl shadow-sm",
        collapsed ? "h-9 w-9" : "h-8 w-8",
        item.icon3d || isLinda ? ICON_3D_TILE_CLASS : LINE_ICON_TILE,
        className
      )}
    >
      {item.icon3d ? (
        <Icon3D name={item.icon3d} size={collapsed ? 28 : 24} eager />
      ) : isLinda ? (
        <LindaAvatar decorative className={collapsed ? "size-7" : "size-6"} />
      ) : (
        <item.icon className={collapsed ? "h-4 w-4" : "h-3.5 w-3.5"} />
      )}
      {children}
    </span>
  );
}

function CountPill({
  count,
  label,
  className,
}: {
  count?: number;
  /** What the count means, for screen readers ("3 loan applications awaiting approval"). */
  label?: string;
  className?: string;
}) {
  if (!count || count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-brand-orange px-1.5 py-0.5 text-[10px] font-bold text-white leading-none",
        className
      )}
    >
      <span aria-hidden={label ? true : undefined}>{count > 99 ? "99+" : count}</span>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

/**
 * Unread notifications in this section the user hasn't opened yet. Red, unlike
 * the orange work counts, and gone once the page they point to is viewed.
 */
function NewPill({ count, label }: { count?: number; label?: string }) {
  if (!count || count <= 0) return null;
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
      <span aria-hidden={label ? true : undefined}>{count > 99 ? "99+" : count}</span>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

// ── Nav Link ──

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
  badge,
  badgeLabel,
  childBadges,
  unseen,
  childUnseen,
}: {
  item: NavItem;
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  badge?: number;
  /** Screen-reader text for `badge`; the pill and the collapsed dot are visual only. */
  badgeLabel?: string;
  /** Count shown on a child link, keyed by its href. */
  childBadges?: Record<string, number>;
  /** Unread notifications in this section not yet viewed. */
  unseen?: number;
  /** The same per child link, keyed by its href. */
  childUnseen?: Record<string, number>;
}) {
  const { can } = usePermission();
  // Children are filtered, not just the parent. `SIDEBAR_NAV.filter` below
  // gates the top-level item on ITS permission, which for Settings is
  // `settings:view` — so a child that guards on something stricter used to be
  // offered to everyone who could open the parent, and clicking it landed on
  // AccessDenied. A child with no `permission` of its own inherits the
  // parent's, which is why every pre-existing child is untouched by this.
  const visibleChildren = useMemo(
    () => (item.children ?? []).filter((c) => navChildAllowed(c, can)),
    // `can` reads the auth store through a fresh closure on every render, so it
    // is not referentially stable; depending on it would rebuild this array
    // every render and defeat the memo. The permissions it reads only change
    // when the user does, and that remounts the whole app shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item.children]
  );
  // Deliberately `visibleChildren`, not `item.children`: an item whose every
  // child is hidden must render as a plain link, not as an expander that opens
  // onto nothing.
  const hasChildren = visibleChildren.length > 0;
  const isExactMatch = pathname === item.href;
  const isPrefixMatch = pathname.startsWith(item.href + "/");
  // For items without children, active on exact or prefix match
  // For items with children, only used to expand — dot shown on child only
  const isActive = hasChildren ? false : (isExactMatch || isPrefixMatch);
  const isChildActive = hasChildren
    ? visibleChildren.some((c) => pathname === c.href)
    : false;
  const isOpen = isExactMatch || isPrefixMatch || isChildActive;
  const [expanded, setExpanded] = useState(isOpen);

  // Auto-expand when navigating to a child route
  useEffect(() => {
    if (isOpen) setExpanded(true);
  }, [isOpen]);
  const unseenLabel = newLabel(unseen, item.title);
  const fullLabel = [unseenLabel, badgeLabel].filter(Boolean).join(", ") || undefined;

  // ── Collapsed ──
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={navItemHref(item, can)}
              onClick={onNavigate}
              // Only an icon shows, so the link is named here, the same way for
              // every item; this also overrides an icon's own alt text.
              aria-label={collapsedNavLabel(item.title, fullLabel)}
              className={cn(
                "flex items-center justify-center rounded-2xl p-2 transition-all duration-200",
                "hover:bg-muted",
                (isActive || isChildActive) && "bg-brand-orange/8 ring-1 ring-brand-orange/20"
              )}
            />
          }
        >
          <NavItemIcon item={item} collapsed>
            {unseen && unseen > 0 ? (
              <span
                aria-hidden="true"
                className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-background"
              >
                {unseen > 99 ? "99+" : unseen}
              </span>
            ) : badge && badge > 0 ? (
              <span
                aria-hidden="true"
                className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-brand-orange ring-2 ring-background"
              />
            ) : null}
          </NavItemIcon>
        </TooltipTrigger>
        <TooltipContent side="right" className={hasChildren ? "flex flex-col gap-1 p-2.5 min-w-[140px]" : undefined}>
          {hasChildren ? (
            <>
              <span className="font-semibold text-xs mb-1 text-foreground">{item.title}</span>
              {visibleChildren.map((child) => (
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
        href={navItemHref(item, can)}
        onClick={onNavigate}
        className={cn(
          "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
          isActive
            ? "bg-gradient-to-r from-brand-orange/10 to-brand-orange/5 text-brand-orange font-semibold shadow-sm ring-1 ring-brand-orange/10"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <NavItemIcon item={item} className="transition-transform duration-200 group-hover:scale-110" />
        <span className="truncate">{item.title}</span>
        {unseen && unseen > 0 ? (
          <span className="ml-auto flex items-center gap-1">
            <NewPill count={unseen} label={unseenLabel} />
            <CountPill count={badge} label={badgeLabel} />
          </span>
        ) : badge && badge > 0 ? (
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
        <NavItemIcon item={item} className="transition-transform duration-200 group-hover:scale-110" />
        <span className="flex-1 text-left truncate">{item.title}</span>
        {/* Visible while the menu is closed; the child link carries it once open. */}
        {!expanded && <NewPill count={unseen} label={unseenLabel} />}
        {!expanded && <CountPill count={badge} label={badgeLabel} />}
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-300", expanded && "rotate-180")} />
      </button>
      {/*
        `max-h-[40rem]` is a transition trick, not a layout intent: height
        cannot animate to `auto`, so this stands in for "tall enough for the
        longest menu". It has to actually BE tall enough — anything over the
        cap is silently clipped with no scrollbar to hint at it.

        Sized for Accounting's 13 children at ~34px each (~440px). The previous
        `max-h-96` (384px) fit Settings' 10 with barely any room and would have
        cut Accounting off mid-list. Re-check this when adding to either menu.
      */}
      <div className={cn("overflow-hidden transition-all duration-300 ease-in-out", expanded ? "max-h-[40rem] opacity-100 mt-1" : "max-h-0 opacity-0")}>
        <div className="ml-6 flex flex-col gap-0.5 border-l-2 border-brand-orange/15 pl-4">
          {visibleChildren.map((child) => {
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
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate">{child.title}</span>
                  {/* Only while open: the closed submenu stays in the accessibility
                      tree, and the parent already announces the count. */}
                  <span className="flex items-center gap-1">
                    <NewPill
                      count={expanded ? childUnseen?.[child.href] : undefined}
                      label={newLabel(childUnseen?.[child.href], child.title)}
                    />
                    <CountPill
                      count={expanded ? childBadges?.[child.href] : undefined}
                      label={child.href === item.href ? badgeLabel : undefined}
                    />
                  </span>
                </span>
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
  //
  // Only asked for by someone who can see members: the badge sits on the
  // Members item, which needs `borrowers:view`, and for anyone else the
  // request is a 403 on every page they open.
  const { total: pendingRegistrationsCount } = useRegistrations({
    status: "pending",
    per_page: 1,
    enabled: can("borrowers:view"),
  });
  // Loans waiting on the signed-in user's approval step. Only asked for by
  // someone who can read the list it is counted from (`GET /loans` needs
  // loans:view); the server limits the count to the user's own steps.
  const pendingLoanApprovals = usePendingLoanApprovals(pendingApprovalsBadgeEnabled(can));
  // "New" badges: unread notifications per section, until the user opens them.
  const unseen = useUnseenNavBadges(SIDEBAR_NAV, pathname, can);
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
          {SIDEBAR_NAV.filter((item) => navItemAllowed(item, can)).map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onNavigate}
              badge={
                item.href === "/borrowers"
                  ? pendingRegistrationsCount
                  : item.href === "/loans"
                    ? pendingLoanApprovals
                    : undefined
              }
              badgeLabel={
                item.href === "/borrowers"
                  ? countLabel(pendingRegistrationsCount, "registration", "awaiting review")
                  : item.href === "/loans"
                    ? countLabel(pendingLoanApprovals, "loan application", "awaiting your approval")
                    : undefined
              }
              childBadges={
                item.href === "/loans" ? { "/loans": pendingLoanApprovals } : undefined
              }
              unseen={unseen.items[item.href]}
              childUnseen={unseen.children}
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
  const sidebarCollapsed = useUIStore(selectSidebarCollapsed);
  const toggleSidebarCollapsed = useUIStore((s) => s.toggleSidebarCollapsed);
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
