import type { Permission } from "@/types";
import { navItemAllowed, navItemHref, type NavItem } from "@/constants/navigation";

/**
 * Menu Visibility's page rules (finish run round 6), shared by the app shell's
 * gate, the command palette and the breadcrumb. `isPathHidden` answers whether
 * a page belongs to a hidden module (`useMenuVisibility`).
 */

/** What the app shell does with a page: wait for the first answer, show it, or read not found. */
export type RouteVisibility = "wait" | "show" | "not_found";

/**
 * A hidden module's pages read not found, direct URLs included. /dashboard
 * itself always opens: while Dashboard is hidden, it sends people on to the
 * first visible menu (`dashboardLanding`), since signing in lands there.
 */
export function routeVisibility(
  pathname: string,
  loaded: boolean,
  isPathHidden: (pathname: string) => boolean,
): RouteVisibility {
  if (!loaded) return "wait";
  if (pathname === "/dashboard") return "show";
  return isPathHidden(pathname) ? "not_found" : "show";
}

/** The command palette's menu links: the visible menu's sections the user may open, each to its first page. */
export function paletteLinks(
  menu: readonly NavItem[],
  can: (permission: Permission) => boolean,
): { item: NavItem; href: string }[] {
  return menu.filter((item) => navItemAllowed(item, can)).map((item) => ({ item, href: navItemHref(item, can) }));
}

/** Links (the palette's quick actions) whose page isn't in a hidden module. */
export function visibleByPath<T extends { href: string }>(links: readonly T[], isPathHidden: (pathname: string) => boolean): T[] {
  return links.filter((link) => !isPathHidden(link.href));
}

/** The header's breadcrumb names a page only while its module shows. */
export function breadcrumbShown(pathname: string, isPathHidden: (pathname: string) => boolean): boolean {
  return !isPathHidden(pathname);
}
