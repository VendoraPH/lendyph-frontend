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
 * - `auto_credit` (`auto_credit:process`) is named so the catalog can list the
 *   API's full set; the matrix doesn't offer it either.
 *
 * `credit_scoring` is offered again: the backend seeds
 * `credit_scoring:view|override|settings` (admin and super_admin hold them by
 * default) and answers its placeholder routes with 501 until the module's
 * endpoints are built. An API that predates that refuses a save naming one
 * with a 422; the roles page then names the permission (`role-save-error.ts`).
 * Contract: `docs/CREDIT_SCORING_BACKEND_HANDOFF.md`.
 *
 * `reminders` is offered too (Phase 2): the backend seeds
 * `reminders:view|send|pause|settings` for admin and super_admin.
 */
export type UIModule = Exclude<Module, "collections" | "loan_adjustments" | "auto_credit">;

// Applicable actions per module — only the actions that make sense for each area
export const MODULE_ACTIONS: Record<UIModule, Action[]> = {
  fees: ["view", "create", "update", "delete"],
  dashboard: ["view"],
  borrowers: ["view", "create", "update", "delete", "approve"],
  // `write_off` (writing off a restructure's shortfall) is seeded for admin
  // and super_admin; the API's grant guard still refuses it to anyone who
  // doesn't hold it themselves. It's left out of the module toggle (below).
  loans: ["view", "create", "update", "delete", "approve", "reject", "release", "restructure", "write_off"],
  // `manage` only: creating, editing and deleting products. Viewing them needs
  // `loans:view`, so there is no `loan_products:view` to offer.
  loan_products: ["manage"],
  payments: ["view", "create", "update", "void"],
  share_capital: ["view", "create", "update"],
  collaterals: ["view", "create", "update", "delete"],
  reports: ["view", "export"],
  users: ["view", "create", "update", "delete"],
  // `view_all` only: every branch's data. Without it a user sees just the
  // branches they are assigned to; there is no other branch verb to offer.
  branches: ["view_all"],
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
  // whole book. `allowance` (posting the allowance for credit losses) is kept
  // apart from `journals:post`: the allowance run writes an automatic posting
  // against 1200 for every branch, so a bookkeeper who may post a manual
  // journal still can't post one. The API seeds it for super_admin, admin and
  // accountant.
  accounting: ["view", "reconcile", "close", "settings", "allowance"],
  chart_of_accounts: ["view", "create", "update", "delete"],
  // No `update` or `delete`: a posted entry is immutable, and the only lawful
  // correction is `reverse`, which writes a second entry rather than editing
  // the first. Granting "edit a journal" would be granting "rewrite history".
  journals: ["view", "create", "post", "reverse"],
  // `pay` settles a payable: it posts the payment out of a cash account.
  expenses: ["view", "create", "update", "pay"],
  cash_accounts: ["view", "transfer"],
  // `settings` (not `configure`) mirrors `accounting:settings`; `override` is
  // the human decision verb, an action on the borrower profile, not a page.
  credit_scoring: ["view", "override", "settings"],
  // `send` is one manual reminder to a member, `pause` stops reminders
  // (all, one member or one loan), `settings` covers rules, templates and the
  // provider set-up.
  reminders: ["view", "send", "pause", "settings"],
};

/**
 * Actions offered with their own checkbox only. The module's "toggle all"
 * neither grants nor revokes them: writing off a restructure's shortfall
 * destroys debt, and posting the allowance moves every branch's books, so
 * neither is swept in with the rest of its module.
 */
const OWN_CHECKBOX_ONLY: Partial<Record<UIModule, readonly Action[]>> = {
  loans: ["write_off"],
  accounting: ["allowance"],
};

/** The actions a module's "toggle all" checkbox covers. */
export function moduleToggleActions(mod: UIModule): Action[] {
  const own = OWN_CHECKBOX_ONLY[mod] ?? [];
  return MODULE_ACTIONS[mod].filter((act) => !own.includes(act));
}
