"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Banknote,
  Bell,
  FolderOpen,
  Home,
  IdCard,
  Inbox,
  Landmark,
  LogOut,
  Megaphone,
  MoreHorizontal,
  PiggyBank,
  Receipt,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { isActivePath, visibleNav, type PortalNavIcon, type PortalNavItem } from "@/lib/portal/nav";
import { portalService } from "@/lib/portal/portal-api";
import { usePortalSession } from "@/lib/portal/portal-session";
import type { PortalMember } from "@/lib/portal/types";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./notification-bell";
import { usePortalConfig } from "./portal-config";
import { PortalLogo } from "./portal-logo";

const ICONS: Record<PortalNavIcon, LucideIcon> = {
  home: Home,
  loans: Landmark,
  savings: PiggyBank,
  share_capital: Banknote,
  requests: Inbox,
  documents: FolderOpen,
  announcements: Megaphone,
  notifications: Bell,
  membership: IdCard,
  profile: UserRound,
  security: ShieldCheck,
  payments: Receipt,
};

/**
 * The signed-in member frame (carried over from #511 by Augustin): a top bar,
 * and on a phone a bottom tab bar with four tabs and "More". From `lg` up the
 * pages sit in the top bar. Works at 390 px.
 */
export function PortalShell({ member, children }: { member: PortalMember; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { name } = usePortalConfig();
  const features = usePortalSession((s) => s.features);
  const signOut = usePortalSession((s) => s.signOut);
  const nav = visibleNav(features);
  const tabs = nav.filter((item) => item.tab);
  const more = nav.filter((item) => !item.tab);

  const logout = () => {
    portalService
      .logout()
      .catch(() => undefined)
      .then(() => {
        signOut();
        router.replace("/member/login");
      });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#member-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/member" className="flex min-w-0 items-center gap-2">
            <PortalLogo />
            <span className="hidden truncate text-sm font-semibold sm:inline">{name}</span>
          </Link>
          <nav aria-label="Member portal" className="ml-2 hidden gap-0.5 lg:flex">
            {[...tabs, ...more.slice(0, 2)].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground",
                  isActivePath(pathname, item.href) && "bg-muted text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
            <MoreMenu items={more.slice(2)} pathname={pathname} side="bottom" className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted">
              More
            </MoreMenu>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <span className="hidden max-w-40 truncate text-sm text-muted-foreground xl:inline">{member.full_name || member.first_name}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main id="member-main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 lg:pb-10">
        {children}
      </main>

      <nav
        aria-label="Member portal tabs"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {tabs.map((item) => (
          <TabLink key={item.href} item={item} active={isActivePath(pathname, item.href)} />
        ))}
        <MoreMenu
          items={more}
          pathname={pathname}
          side="top"
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground",
            more.some((item) => isActivePath(pathname, item.href)) && "text-brand-orange",
          )}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden />
          More
        </MoreMenu>
      </nav>
    </div>
  );
}

function MoreMenu({
  items,
  pathname,
  side,
  className,
  children,
}: {
  items: PortalNavItem[];
  pathname: string;
  side: "top" | "bottom";
  className: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  if (items.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn("outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={side} className="w-52">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <DropdownMenuItem
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(isActivePath(pathname, item.href) && "font-medium text-brand-orange")}
            >
              <Icon className="mr-2 h-4 w-4" aria-hidden />
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TabLink({ item, active }: { item: PortalNavItem; active: boolean }) {
  const Icon = ICONS[item.icon];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground", active && "text-brand-orange")}
    >
      <Icon className="h-5 w-5" aria-hidden />
      {item.label}
    </Link>
  );
}
