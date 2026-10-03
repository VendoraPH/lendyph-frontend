import { MODULE_ACTIONS, type UIModule } from "./permission-matrix";

const OFFERED_MODULES = Object.keys(MODULE_ACTIONS) as UIModule[];

/** How many modules the roles screen offers permissions for. */
export const OFFERED_MODULE_TOTAL = OFFERED_MODULES.length;

/**
 * How many of the offered modules a role holds at least one offered action in,
 * for the roles list's "N of total".
 *
 * Roles also hold permissions the matrix has no checkbox for: whole modules
 * (`loan_adjustments:*`, `auto_credit:process`, the retired `collections:*`)
 * and extra actions (`loans:extend`, `users:reset_password`). Counting those
 * read "22 of 20" for Admin, so only what the matrix offers counts, and the
 * count can never exceed the total.
 */
export function roleModuleCount(permissions: readonly string[]): number {
  const held = new Set(permissions);
  return OFFERED_MODULES.filter((mod) =>
    MODULE_ACTIONS[mod].some((action) => held.has(`${mod}:${action}`)),
  ).length;
}
