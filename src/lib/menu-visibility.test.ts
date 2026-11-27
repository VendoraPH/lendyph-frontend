/**
 * Menu Visibility's page rules: which pages read not found, what the command
 * palette offers and when the breadcrumb shows (finish run round 6).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { moduleForPath, moduleHidden } from "@/constants/menu-modules";
import { SIDEBAR_NAV, visibleNav } from "@/constants/navigation";
import type { Permission } from "@/types";
import { breadcrumbParentShown, breadcrumbShown, paletteLinks, routeVisibility, visibleByPath } from "./menu-visibility";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const hiding = (...keys: string[]) => {
  const set = new Set(keys);
  return (pathname: string) => moduleHidden(moduleForPath(pathname), set);
};
const ADMIN = (p: Permission) => p !== "loans:edit_in_approval";

test("pages wait for the first answer, then a hidden module's pages read not found", () => {
  const hidden = hiding("accounting", "payments.auto_pay");
  assert.equal(routeVisibility("/accounting/journals", false, hidden), "wait");
  assert.equal(routeVisibility("/accounting/journals", true, hidden), "not_found");
  assert.equal(routeVisibility("/settings/accounting", true, hidden), "not_found");
  assert.equal(routeVisibility("/payments/auto-pay", true, hidden), "not_found");
  assert.equal(routeVisibility("/payments/history", true, hidden), "show");
  assert.equal(routeVisibility("/settings/profile", true, hidden), "show");
});

test("a hidden parent's submenu pages read not found too", () => {
  assert.equal(routeVisibility("/loans/reminders", true, hiding("loans")), "not_found");
});

test("the dashboard route stays open to send people on, even while Dashboard is hidden", () => {
  assert.equal(routeVisibility("/dashboard", true, hiding("dashboard")), "show");
  assert.equal(routeVisibility("/dashboard/executive", true, hiding("dashboard", "executive_dashboard")), "not_found");
});

test("Settings and Menu Visibility itself never read not found", () => {
  const all = hiding("dashboard", "members", "loans", "accounting", "savings", "linda");
  assert.equal(routeVisibility("/settings/menu-visibility", true, all), "show");
  assert.equal(routeVisibility("/settings/user-roles", true, all), "show");
});

test("the command palette leaves out hidden menus and quick actions into them", () => {
  const isPathHidden = hiding("loans", "gcash");
  const menu = visibleNav(SIDEBAR_NAV, (k) => isPathHidden(SIDEBAR_NAV.find((i) => i.module === k)?.href ?? ""));
  const links = paletteLinks(menu, ADMIN).map((l) => l.href);
  assert.equal(links.includes("/loans"), false);
  assert.equal(links.includes("/gcash"), false);
  assert.ok(links.includes("/payments"));
  const actions = visibleByPath(
    [
      { title: "New Loan", href: "/loans/new" },
      { title: "Record Payment", href: "/payments" },
    ],
    isPathHidden,
  );
  assert.deepEqual(actions.map((a) => a.title), ["Record Payment"]);
});

test("the breadcrumb shows only for a page that isn't hidden", () => {
  assert.equal(breadcrumbShown("/savings/accounts", hiding("savings")), false);
  assert.equal(breadcrumbShown("/settings/profile", hiding("savings")), true);
});

test("the app shell loads the source, gates its pages and the menus read the visible menu", () => {
  const layout = read("src/app/(app)/layout.tsx");
  assert.match(layout, /<MenuVisibilityProvider>/);
  assert.match(layout, /<HiddenModuleGate>\{children\}<\/HiddenModuleGate>/);
  const sidebar = read("src/components/layout/sidebar.tsx");
  assert.match(sidebar, /useVisibleNav\(\)/);
  assert.match(sidebar, /<SidebarSkeleton/);
  assert.doesNotMatch(sidebar, /SIDEBAR_NAV\.filter/);
  const header = read("src/components/layout/header.tsx");
  assert.match(header, /useVisibleNav\(\)/);
  assert.match(header, /accountSettingsHref\(menu, can\)/);
  assert.match(header, /paletteLinks\(menu, can\)/);
  assert.doesNotMatch(header, /SIDEBAR_NAV\.filter/);
  const gate = read("src/components/layout/hidden-module-gate.tsx");
  assert.match(gate, /notFound\(\)/);
});

test("the breadcrumb leaves out a parent whose own page is hidden (Dashboard above Executive Dashboard)", () => {
  assert.equal(breadcrumbParentShown("/dashboard/executive", hiding("dashboard")), false);
  assert.equal(breadcrumbParentShown("/dashboard/executive", hiding()), true);
  assert.equal(breadcrumbParentShown("/payments/history", hiding("payments.auto_pay")), true);
  assert.match(read("src/components/layout/header.tsx"), /breadcrumbParentShown\(pathname, isPathHidden\)/);
});
