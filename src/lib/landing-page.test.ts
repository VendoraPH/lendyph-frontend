/**
 * Where a user lands after signing in.
 *
 * Sign-in sends everyone to the dashboard, and the seeded loan processor,
 * manager and board roles don't hold `dashboard:view`, so they landed on
 * "Access Restricted".
 *
 * WHAT THIS PROVES: the first page is the first one the side menu offers the
 * user, by the menu's own rules (a section's first page is its first child
 * the user can open); the dashboard route sends a user without
 * `dashboard:view` there; the sign-in page is not where it happens.
 * WHAT IT DOES NOT PROVE: that each page's own guard matches its menu entry,
 * which the navigation tests cover.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Permission } from "@/types";
import { moduleHidden } from "@/constants/menu-modules";
import { MEMBER_PORTAL_NAV, SIDEBAR_NAV, visibleNav, type NavItem } from "@/constants/navigation";
import { dashboardLanding, firstAllowedPage } from "./landing-page";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

function holding(...permissions: Permission[]) {
  return (p: Permission) => permissions.includes(p);
}

// The seeded roles without dashboard:view (RoleAndPermissionSeeder).
const LOAN_PROCESSOR = holding(
  "loans:view", "loans:update", "loans:create", "borrowers:view", "fees:view",
  "collaterals:view", "collaterals:update", "share_capital:view",
);
const MANAGER = holding(
  "loans:view", "accounting:view", "chart_of_accounts:view", "journals:view",
  "expenses:view", "cash_accounts:view", "branches:view_all",
);
const BOARD = holding("loans:view", "branches:view_all");

const Icon = () => null;

test("a loan processor lands on All Members, the first page the menu offers them", () => {
  assert.equal(firstAllowedPage(SIDEBAR_NAV, LOAN_PROCESSOR), "/borrowers");
});

test("a manager and a board member land on All Loans", () => {
  assert.equal(firstAllowedPage(SIDEBAR_NAV, MANAGER), "/loans");
  assert.equal(firstAllowedPage(SIDEBAR_NAV, BOARD), "/loans");
});

test("for a dashboard holder the first page is the dashboard itself", () => {
  assert.equal(firstAllowedPage(SIDEBAR_NAV, holding("dashboard:view", "loans:view")), "/dashboard");
});

test("a section's first page is its first child the user can open", () => {
  assert.equal(firstAllowedPage(SIDEBAR_NAV, holding("share_capital:view")), "/share-capital/ledger");
  assert.equal(firstAllowedPage(SIDEBAR_NAV, holding("settings:view")), "/settings/profile");
  const menu: NavItem[] = [
    {
      title: "Settings",
      href: "/settings",
      icon: Icon,
      permission: "settings:view",
      children: [
        { title: "Data Import", href: "/settings/data-import", permission: "imports:process" },
        { title: "Profile", href: "/settings/profile" },
      ],
    },
  ];
  assert.equal(firstAllowedPage(menu, holding("settings:view")), "/settings/profile");
});

test("a section open on any of several permissions goes to the first page the user can open", () => {
  assert.equal(firstAllowedPage([MEMBER_PORTAL_NAV], holding("member_portal:requests")), "/member-portal/requests");
});

test("a section whose every child is hidden is its own page, as the menu links it", () => {
  const menu: NavItem[] = [
    {
      title: "Reports",
      href: "/reports",
      icon: Icon,
      permission: "reports:view",
      children: [{ title: "Exports", href: "/reports/exports", permission: "reports:export" }],
    },
  ];
  assert.equal(firstAllowedPage(menu, holding("reports:view")), "/reports");
});

test("a user the menu offers nothing has no page to land on", () => {
  assert.equal(firstAllowedPage(SIDEBAR_NAV, holding()), null);
});

test("the dashboard sends a user without dashboard:view on, and the sign-in page doesn't", () => {
  const page = read("src/app/(app)/dashboard/page.tsx");
  assert.match(page, /dashboardLanding\(menu, can, isHidden\("dashboard"\)\)/);
  assert.match(page, /const goTo = landing\.kind === "go" \? landing\.href : null;/);
  assert.match(page, /if \(goTo !== null\) router\.replace\(goTo\);/);
  assert.match(page, /if \(landing\.kind === "not_found"\) notFound\(\);/);
  assert.match(page, /<RouteGuard permission="dashboard:view" pageName="Dashboard">/);
  assert.doesNotMatch(read("src/app/(auth)/login/page.tsx"), /firstAllowedPage/);
});

// Menu Visibility (finish run round 6): with Dashboard hidden, signing in (and
// every link to the dashboard) lands on the first visible menu.
const hidingKeys = (...keys: string[]) => (key: string) => moduleHidden(key, new Set(keys));
const ADMIN = (p: Permission) => p !== "loans:edit_in_approval";

test("a dashboard holder stays on the dashboard while it is shown", () => {
  assert.deepEqual(dashboardLanding(visibleNav(SIDEBAR_NAV, hidingKeys()), ADMIN, false), { kind: "dashboard" });
});

test("with Dashboard hidden, everyone lands on the first visible menu", () => {
  const menu = visibleNav(SIDEBAR_NAV, hidingKeys("dashboard"));
  assert.deepEqual(dashboardLanding(menu, ADMIN, true), { kind: "go", href: "/borrowers" });
  const more = visibleNav(SIDEBAR_NAV, hidingKeys("dashboard", "members", "loans"));
  assert.deepEqual(dashboardLanding(more, ADMIN, true), { kind: "go", href: "/payments" });
});

test("a user without dashboard:view skips hidden menus too", () => {
  const menu = visibleNav(SIDEBAR_NAV, hidingKeys("members"));
  assert.deepEqual(dashboardLanding(menu, LOAN_PROCESSOR, false), { kind: "go", href: "/loans" });
});

test("with Dashboard hidden and nothing else to offer, the dashboard reads not found", () => {
  const menu = visibleNav(SIDEBAR_NAV, hidingKeys("dashboard"));
  assert.deepEqual(dashboardLanding(menu, holding("dashboard:view"), true), { kind: "not_found" });
});

test("without dashboard:view and nothing to offer, the dashboard's own guard answers", () => {
  assert.deepEqual(dashboardLanding(SIDEBAR_NAV, holding(), false), { kind: "dashboard" });
});
