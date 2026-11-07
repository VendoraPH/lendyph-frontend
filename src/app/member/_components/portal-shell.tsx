"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Banknote,
  FileText,
  History,
  FolderOpen,
  Home,
  IdCard,
  Inbox,
  Landmark,
  LifeBuoy,
  LogOut,
  Megaphone,
  MoreHorizontal,
  PiggyBank,
  Receipt,
  Search,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { usePortalSession } from "@/lib/portal/portal-session";
import { portalService } from "@/services/portal.service";
import type { PortalFeatures, PortalMember } from "@/types/portal";
import { NotificationBell } from "./notification-bell";
import { usePortalConfig } from "./portal-config";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hidden when this member service is switched off in portal settings. */
  feature?: keyof PortalFeatures;
  /** Shown in the phone tab bar; the rest sit under "More". */
  primary?: boolean;
  /** Also shown in the desktop top bar; the rest sit under its "More". */
  desktop?: boolean;
}

export const PORTAL_NAV: NavItem[] = [
  { href: "/member", label: "Home", icon: Home, primary: true },
  { href: "/member/loans", label: "Loans", icon: Landmark, feature: "loans", primary: true },
  { href: "/member/savings", label: "Savings", icon: PiggyBank, feature: "savings", primary: true },
  { href: "/member/payments", label: "Payments", icon: Receipt, feature: "loans", primary: true },
  { href: "/member/share-capital", label: "Share Capital", icon: Banknote, feature: "share_capital", desktop: true },
  { href: "/member/statements", label: "Statements", icon: FileText, feature: "statements", desktop: true },
  { href: "/member/requests", label: "Requests", icon: Inbox, desktop: true },
  { href: "/member/documents", label: "Documents", icon: FolderOpen, feature: "documents" },
  { href: "/member/announcements", label: "Announcements", icon: Megaphone },
  { href: "/member/activity", label: "Activity", icon: History },
  { href: "/member/help", label: "Help", icon: LifeBuoy, feature: "help_desk" },
  { href: "/member/membership", label: "Membership", icon: IdCard },
  { href: "/member/profile", label: "Profile", icon: UserRound },
  { href: "/member/security", label: "Security", icon: ShieldCheck },
];

/** The nav items this portal's settings switch on. */
export function visibleNav(features: PortalFeatures): NavItem[] {
  return PORTAL_NAV.filter((item) => !item.feature || features[item.feature] !== false);
}

function isActive(pathname: string, href: string): boolean {
  return href === "/member" ? pathname === href : pathname.startsWith(href);
}

/**
 * Mobile first: a top bar and a bottom tab bar on phones, which is where most
 * members will open this; the tabs move into the top bar from `lg` up.
 */
export function PortalShell({ member, children }: { member: PortalMember; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { config } = usePortalConfig();
  const signOut = usePortalSession((s) => s.signOut);
  const nav = visibleNav(config.features);
  const primary = nav.filter((item) => item.primary);
  const more = nav.filter((item) => !item.primary);
  const desktop = nav.filter((item) => item.primary || item.desktop);
  const desktopMore = nav.filter((item) => !item.primary && !item.desktop);

  const logout = () => {
    portalService
      .logout()
      .catch(() => {
        // Ending the session locally is what matters; the token expires anyway.
      })
      .finally(() => {
        signOut();
        router.replace("/member/login");
      });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/member" className="flex items-center gap-2">
            <BrandLogo className="h-8 w-auto" />
            <span className="hidden text-sm font-semibold sm:inline">{config.portal_name}</span>
          </Link>
          <nav aria-label="Member portal" className="ml-2 hidden gap-0.5 lg:flex">
            {desktop.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground",
                  isActive(pathname, item.href) && "bg-muted text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
            <MoreMenu
              items={desktopMore}
              pathname={pathname}
              side="bottom"
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground",
                desktopMore.some((item) => isActive(pathname, item.href)) && "bg-muted text-foreground",
              )}
            >
              More
            </MoreMenu>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search your records"
              nativeButton={false}
              render={<Link href="/member/search" />}
            >
              <Search className="h-4 w-4" />
            </Button>
            <NotificationBell />
            <span className="hidden text-sm text-muted-foreground sm:inline lg:hidden xl:inline">{member.full_name}</span>
            <Button variant="ghost" size="sm" onClick={logout} aria-label="Sign out">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 lg:pb-10">{children}</main>

      <nav
        aria-label="Member portal"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {primary.map((item) => (
          <TabLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
        <MoreMenu
          items={more}
          pathname={pathname}
          side="top"
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground outline-none",
            more.some((item) => isActive(pathname, item.href)) && "text-brand-orange",
          )}
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden />
          More
        </MoreMenu>
      </nav>
    </div>
  );
}

/** The "More" dropdown, shared by the phone tab bar and the desktop top bar. */
function MoreMenu({
  items,
  pathname,
  side,
  className,
  children,
}: {
  items: NavItem[];
  pathname: string;
  side: "top" | "bottom";
  className: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  if (items.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={className}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={side} className="w-52">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.href}
            onClick={() => router.push(item.href)}
            className={cn(isActive(pathname, item.href) && "font-medium text-brand-orange")}
          >
            <item.icon className="mr-2 h-4 w-4" aria-hidden />
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground",
        active && "text-brand-orange",
      )}
    >
      <item.icon className="h-5 w-5" aria-hidden />
      {item.label}
    </Link>
  );
}

/** Page heading used by every signed-in screen. */
export function PortalPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  /** Buttons beside the title, e.g. "New request". */
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** A small coloured status pill. */
export function StatusPill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}
