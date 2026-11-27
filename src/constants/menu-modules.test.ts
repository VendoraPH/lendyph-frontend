/**
 * Menu Visibility's module map: every side-menu entry, every Settings page and
 * every page route belongs to a module (or is one of Settings' own pages), and
 * the menus drop what is hidden. Every flag is on here, so the flag-gated
 * entries are in the menu; each test file runs in its own process.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Permission } from "@/types";

const FLAGS = [
  "NEXT_PUBLIC_ENABLE_AMLA",
  "NEXT_PUBLIC_ENABLE_CDA",
  "NEXT_PUBLIC_ENABLE_CREDIT_SCORING",
  "NEXT_PUBLIC_ENABLE_EXECUTIVE_DASHBOARD",
  "NEXT_PUBLIC_ENABLE_LINDA",
  "NEXT_PUBLIC_ENABLE_LOAN_ORIGINATION",
  "NEXT_PUBLIC_ENABLE_MEMBER_PORTAL",
  "NEXT_PUBLIC_ENABLE_MULTI_BRANCH",
  "NEXT_PUBLIC_ENABLE_PENALTY_CONFIGS",
  "NEXT_PUBLIC_ENABLE_SAVINGS",
  "NEXT_PUBLIC_ENABLE_BINHS_AMORTIZATION",
];

let nav: typeof import("./navigation");
let mods: typeof import("./menu-modules");

before(async () => {
  for (const flag of FLAGS) process.env[flag] = "true";
  nav = await import("./navigation");
  mods = await import("./menu-modules");
});

const everyone = () => true;
const hiding = (...keys: string[]) => {
  const set = new Set(keys);
  return (key: string | null | undefined) => mods.moduleHidden(key, set);
};

/** The contract's keys, in the side menu's order. */
const CONTRACT_KEYS = [
  "dashboard",
  "executive_dashboard",
  "linda",
  "members",
  "loans",
  "loans.reminders",
  "loans.origination",
  "payments",
  "payments.auto_pay",
  "share_capital",
  "share_capital.auto_credit",
  "savings",
  "collateral",
  "gcash",
  "credit_scoring",
  "cic",
  "cda",
  "member_portal",
  "amla",
  "accounting",
  "users",
  "reports",
  "documents",
  "audit_trail",
];

/** Settings' own pages: no module owns them, so they are never hidden. */
const SETTINGS_OWN = [
  "/settings/profile",
  "/settings/branding",
  "/settings/branches",
  "/settings/user-roles",
  "/settings/approval-workflow",
  "/settings/data-import",
  "/settings/menu-visibility",
];

test("the module map holds exactly the contract's keys, in the side menu's order", () => {
  assert.deepEqual(
    mods.MENU_MODULES.map((m) => m.key),
    CONTRACT_KEYS,
  );
  for (const m of mods.MENU_MODULES) {
    if (m.parent) assert.ok(mods.menuModule(m.parent), m.key);
    assert.ok(m.paths.length > 0, m.key);
  }
});

test("every side-menu entry carries its module, and it is the module its own path resolves to", () => {
  for (const item of nav.SIDEBAR_NAV) {
    if (item.href === "/settings") {
      assert.equal(item.module, undefined, "Settings is always on");
      continue;
    }
    assert.ok(item.module, `${item.title} has no module`);
    assert.equal(mods.moduleForPath(item.href), item.module, item.href);
    for (const child of item.children ?? []) {
      const own: string | undefined = child.module ?? item.module;
      assert.equal(mods.moduleForPath(child.href), own, `${item.title} → ${child.title}`);
    }
  }
});

test("the four submenus carry their own keys", () => {
  const child = (section: string, href: string) =>
    nav.SIDEBAR_NAV.find((i) => i.href === section)?.children?.find((c) => c.href === href);
  assert.equal(child("/loans", "/loans/reminders")?.module, "loans.reminders");
  assert.equal(child("/loans", "/loans/origination")?.module, "loans.origination");
  assert.equal(child("/payments", "/payments/auto-pay")?.module, "payments.auto_pay");
  assert.equal(child("/share-capital", "/share-capital/auto-credit")?.module, "share_capital.auto_credit");
});

test("every Settings page carries the module it belongs to, or is one of Settings' own pages", () => {
  const settings = nav.SIDEBAR_NAV.find((i) => i.href === "/settings");
  assert.ok(settings?.children);
  for (const child of settings.children) {
    if (SETTINGS_OWN.includes(child.href)) {
      assert.equal(child.module, undefined, child.href);
      assert.equal(mods.moduleForPath(child.href), null, child.href);
    } else {
      assert.ok(child.module, `${child.href} has no module`);
      assert.equal(mods.moduleForPath(child.href), child.module, child.href);
    }
  }
  const owned = (href: string) => settings.children?.find((c) => c.href === href)?.module;
  assert.equal(owned("/settings/accounting"), "accounting");
  assert.equal(owned("/settings/savings"), "savings");
  assert.equal(owned("/settings/cda"), "cda");
  assert.equal(owned("/settings/credit-scoring"), "credit_scoring");
  assert.equal(owned("/settings/linda"), "linda");
  assert.equal(owned("/settings/amla"), "amla");
  assert.equal(owned("/settings/member-portal"), "member_portal");
  assert.equal(owned("/settings/gcash"), "gcash");
});

/** Every page folder under `src/app/(app)`, as its URL path (dynamic and private segments left out). */
function pageRoutes(): string[] {
  const root = resolve(process.cwd(), "src/app/(app)");
  const out: string[] = [];
  const walk = (dir: string, path: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (!statSync(full).isDirectory()) continue;
      if (name.startsWith("_") || name.startsWith("[") || name.startsWith("(")) continue;
      const next = `${path}/${name}`;
      out.push(next);
      walk(full, next);
    }
  };
  walk(root, "");
  return out;
}

test("every page route belongs to a module, except Settings' own pages", () => {
  for (const route of pageRoutes()) {
    if (route === "/settings" || SETTINGS_OWN.includes(route) || SETTINGS_OWN.some((p) => route.startsWith(`${p}/`))) {
      assert.equal(mods.moduleForPath(route), null, route);
      continue;
    }
    assert.notEqual(mods.moduleForPath(route), null, `${route} belongs to no module`);
  }
});

test("paths match by whole segments, and the longest prefix wins", () => {
  assert.equal(mods.moduleForPath("/dashboard"), "dashboard");
  assert.equal(mods.moduleForPath("/dashboard/executive"), "executive_dashboard");
  assert.equal(mods.moduleForPath("/loans/reminders/rules"), "loans.reminders");
  assert.equal(mods.moduleForPath("/loans/12"), "loans");
  assert.equal(mods.moduleForPath("/savingsx"), null);
  assert.equal(mods.moduleForPath("/savings/accounts/3?tab=x"), "savings");
  assert.equal(mods.moduleForPath("/payments/auto-pay/"), "payments.auto_pay");
});

test("a module is hidden when it or its parent is", () => {
  const set = new Set(["loans"]);
  assert.equal(mods.moduleHidden("loans", set), true);
  assert.equal(mods.moduleHidden("loans.reminders", set), true);
  assert.equal(mods.moduleHidden("payments.auto_pay", set), false);
  assert.equal(mods.moduleHidden(null, set), false);
});

test("the side menu drops a hidden module and its submenus, and a hidden submenu alone", () => {
  const menu = nav.visibleNav(nav.SIDEBAR_NAV, hiding("savings", "linda", "loans.reminders"));
  const hrefs = menu.map((i) => i.href);
  assert.equal(hrefs.includes("/savings"), false);
  assert.equal(hrefs.includes("/linda"), false);
  const loans = menu.find((i) => i.href === "/loans");
  assert.ok(loans?.children?.some((c) => c.href === "/loans/new"));
  assert.equal(loans?.children?.some((c) => c.href === "/loans/reminders"), false);
  const hiddenParent = nav.visibleNav(nav.SIDEBAR_NAV, hiding("loans"));
  assert.equal(hiddenParent.some((i) => i.href === "/loans"), false);
  assert.equal(nav.visibleNav(nav.SIDEBAR_NAV, hiding()).length, nav.SIDEBAR_NAV.length);
});

test("Settings drops a hidden module's settings pages and stays itself", () => {
  const menu = nav.visibleNav(nav.SIDEBAR_NAV, hiding("savings", "accounting", "linda", "member_portal"));
  const settings = menu.find((i) => i.href === "/settings");
  assert.ok(settings);
  const hrefs = (settings.children ?? []).map((c) => c.href);
  for (const gone of ["/settings/savings", "/settings/savings-products", "/settings/accounting", "/settings/linda", "/settings/member-portal"]) {
    assert.equal(hrefs.includes(gone), false, gone);
  }
  for (const kept of ["/settings/profile", "/settings/cda", "/settings/data-import", "/settings/menu-visibility"]) {
    assert.ok(hrefs.includes(kept), kept);
  }
  // Every module hidden: Settings still shows.
  const all = nav.visibleNav(nav.SIDEBAR_NAV, hiding(...CONTRACT_KEYS));
  assert.deepEqual(all.map((i) => i.href), ["/settings"]);
});

test("Menu Visibility sits in Settings for menu_visibility:manage holders only", () => {
  const settings = nav.SIDEBAR_NAV.find((i) => i.href === "/settings");
  const link = settings?.children?.find((c) => c.href === "/settings/menu-visibility");
  assert.ok(link);
  assert.equal(link.title, "Menu Visibility");
  assert.equal(link.permission, "menu_visibility:manage");
  const holds = (...keys: Permission[]) => (p: Permission) => keys.includes(p);
  assert.equal(nav.navChildAllowed(link, holds("settings:view")), false);
  assert.equal(nav.navChildAllowed(link, holds("menu_visibility:manage")), true);
  assert.equal(nav.navItemAllowed(settings!, holds("menu_visibility:manage")), true);
  assert.ok(everyone());
});
