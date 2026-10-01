import type { Action, Module } from "@/types";

/**
 * The modules the roles screen offers permissions for.
 *
 * Modules in `Module` that the API holds no permissions for are left out. A
 * role update that names a permission the API does not have is refused whole
 * (422 on `permissions.N`), so offering one breaks every later save of that
 * role, not just the one tick.
 *
 * - `collections` is retired and no longer used in the system.
 * - `loan_adjustments` is named in the type so pages can check it; the matrix
 *   has never offered it, and a role keeps whatever it holds on save.
 *
 * `credit_scoring` is offered again, but the backend must seed
 * `credit_scoring:view|override|settings` before anyone ticks it: until it
 * does, saving a role with one ticked answers 422 (that is how `PUT /roles/{id}`
 * failed on staging). Contract: `docs/CREDIT_SCORING_BACKEND_HANDOFF.md`.
 */
export type UIModule = Exclude<Module, "collections" | "loan_adjustments">;

// Applicable actions per module — only the actions that make sense for each area
export const MODULE_ACTIONS: Record<UIModule, Action[]> = {
  fees: ["view", "create", "update", "delete"],
  dashboard: ["view"],
  borrowers: ["view", "create", "update", "delete", "approve"],
  loans: ["view", "create", "update", "delete", "approve", "reject", "release", "restructure"],
  payments: ["view", "create", "update", "void"],
  share_capital: ["view", "create", "update"],
  collaterals: ["view", "create", "update", "delete"],
  reports: ["view", "export"],
  users: ["view", "create", "update", "delete"],
  settings: ["view", "update"],
  audit_logs: ["view", "export"],
  auto_pay: ["view", "process", "toggle"],
  gcash: ["view", "transact", "settings"],
  // `process` only. There is no `imports:view`: the page has nothing to look at
  // without running one, so a view-only grant would be a link to an empty
  // wizard, and the template literal `Module:Action` type would happily mint it.
  imports: ["process"],
  // `close` and `settings` sit on `accounting` rather than on a module of their
  // own because neither has a screen to view — they are verbs applied to the
  // whole book.
  accounting: ["view", "reconcile", "close", "settings"],
  chart_of_accounts: ["view", "create", "update", "delete"],
  // No `update` or `delete`: a posted entry is immutable, and the only lawful
  // correction is `reverse`, which writes a second entry rather than editing
  // the first. Granting "edit a journal" would be granting "rewrite history".
  journals: ["view", "create", "post", "reverse"],
  expenses: ["view", "create", "update"],
  cash_accounts: ["view", "transfer"],
  // `settings` (not `configure`) mirrors `accounting:settings`; `override` is
  // the human decision verb, an action on the borrower profile, not a page.
  credit_scoring: ["view", "override", "settings"],
};
