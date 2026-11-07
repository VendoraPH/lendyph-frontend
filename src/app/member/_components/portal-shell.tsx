"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, IdCard, LogOut, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { BrandLogo } from "@/components/common";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePortalSession } from "@/lib/portal/portal-session";
import { portalService } from "@/services/portal.service";
import type { PortalMember } from "@/types/portal";
import { usePortalConfig } from "./portal-config";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Later PRs add Loans, Savings, Share Capital, Payments and Requests here. */
export const PORTAL_NAV: NavItem[] = [
  { href: "/member", label: "Home", icon: Home },
  { href: "/member/membership", label: "Membership", icon: IdCard },
  { href: "/member/profile", label: "Profile", icon: UserRound },
  { href: "/member/security", label: "Security", icon: ShieldCheck },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/member" ? pathname === href : pathname.startsWith(href);
}

/**
 * Mobile first: a top bar and a bottom tab bar on phones, which is where most
 * members will open this; the tabs move into the top bar from `md` up.
 */
export function PortalShell({ member, children }: { member: PortalMember; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { config } = usePortalConfig();
  const signOut = usePortalSession((s) => s.signOut);

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
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Link href="/member" className="flex items-center gap-2">
            <BrandLogo className="h-8 w-auto" />
            <span className="hidden text-sm font-semibold sm:inline">{config.portal_name}</span>
          </Link>
          <nav aria-label="Member portal" className="ml-4 hidden gap-1 md:flex">
            {PORTAL_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                  isActive(pathname, item.href) && "bg-muted text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{member.full_name}</span>
            <Button variant="ghost" size="sm" onClick={logout} aria-label="Sign out">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 md:pb-10">{children}</main>

      <nav
        aria-label="Member portal"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {PORTAL_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground",
                active && "text-brand-orange",
              )}
            >
              <item.icon className="h-5 w-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Page heading used by every signed-in screen. */
export function PortalPageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5 space-y-1">
      <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
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
