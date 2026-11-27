import type { Permission } from "@/types";
import { navChildAllowed, navItemAllowed, navItemHref, type NavItem } from "@/constants/navigation";

/**
 * The first page the side menu offers this user, by the menu's own rules:
 * the first section they may open, and in it the first page they may open
 * (a section whose pages are all hidden is a link of its own). Null when the
 * menu offers them nothing.
 *
 * Where signing in lands a user who can't see the dashboard (the seeded loan
 * processor, manager and board roles), instead of "Access Restricted".
 */
export function firstAllowedPage(
  menu: readonly NavItem[],
  can: (permission: Permission) => boolean,
): string | null {
  const section = menu.find((item) => navItemAllowed(item, can));
  if (!section) return null;
  const page = (section.children ?? []).find((child) => navChildAllowed(child, can));
  return page ? page.href : navItemHref(section, can);
}

/** What the dashboard route does: show the dashboard, go to another page, or read not found. */
export type DashboardLanding = { kind: "dashboard" } | { kind: "go"; href: string } | { kind: "not_found" };

/**
 * Where /dashboard takes a user, given the menu Menu Visibility leaves
 * (`visibleNav`). Signing in, the not-found page's home link and "Access
 * Restricted" all go to /dashboard, so this one rule decides where they land:
 * - the dashboard, for a holder of `dashboard:view` while Dashboard is shown;
 * - otherwise the first page the menu offers;
 * - with nothing to offer, the dashboard's own guard ("Access Restricted"),
 *   or not found when Dashboard itself is hidden.
 */
export function dashboardLanding(
  menu: readonly NavItem[],
  can: (permission: Permission) => boolean,
  dashboardHidden: boolean,
): DashboardLanding {
  if (!dashboardHidden && can("dashboard:view")) return { kind: "dashboard" };
  const href = firstAllowedPage(menu, can);
  if (href !== null && href !== "/dashboard") return { kind: "go", href };
  return dashboardHidden ? { kind: "not_found" } : { kind: "dashboard" };
}
