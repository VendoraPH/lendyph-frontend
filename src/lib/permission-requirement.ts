import type { Permission } from "@/types";

/**
 * What a page or menu link needs: one permission, or a list of which any one
 * is enough (a page shared by two roles, such as one screen for those who post
 * and those who approve).
 */
export type PermissionRequirement = Permission | Permission[];

/**
 * True when `can` grants the requirement. An empty list grants nothing, so a
 * guard can never open by accident. `RouteGuard` and the sidebar both decide
 * through this, so a link is shown exactly when its page opens.
 */
export function meetsPermission(
  required: PermissionRequirement,
  can: (permission: Permission) => boolean,
): boolean {
  return typeof required === "string" ? can(required) : required.some(can);
}
