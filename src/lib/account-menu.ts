import type { Permission } from "@/types";
import { navItemAllowed, navItemHref, type NavItem } from "@/constants/navigation";

/**
 * The signed-in user's own Profile. The server lets every signed-in, active
 * user read and save their profile (GET and PATCH /auth/me), so neither the
 * page nor its account menu item needs a permission.
 */
export const OWN_PROFILE_HREF = "/settings/profile";

/**
 * Where the account menu's Settings goes: the first Settings page the user
 * can open, by the side menu's own rule (`navItemHref`); null when they can
 * open none, and the menu leaves Settings out.
 */
export function accountSettingsHref(
  menu: readonly NavItem[],
  can: (permission: Permission) => boolean,
): string | null {
  const settings = menu.find((item) => item.href === "/settings");
  return settings && navItemAllowed(settings, can) ? navItemHref(settings, can) : null;
}
