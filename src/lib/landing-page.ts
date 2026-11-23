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
