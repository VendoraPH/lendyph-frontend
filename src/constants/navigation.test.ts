import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "@/config/env";
import { CDA_NAV, MEMBER_PORTAL_NAV, SIDEBAR_NAV, navChildAllowed, navItemAllowed, navItemHref } from "./navigation";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const LAYOUT = "src/app/(app)/credit-scoring/layout.tsx";

test("Credit Scoring is off when the flag isn't set", () => {
  assert.equal(env.features.creditScoring, false);
  assert.equal(SIDEBAR_NAV.some((item) => item.href === "/credit-scoring"), false);
});

test("the flag is read literally, so Next inlines it into the browser bundle", () => {
  assert.match(read("src/config/env.ts"), /process\.env\.NEXT_PUBLIC_ENABLE_CREDIT_SCORING/);
});

test("every Credit Scoring route answers not found while the flag is off", () => {
  assert.equal(existsSync(resolve(process.cwd(), LAYOUT)), true);
  const layout = read(LAYOUT);
  assert.match(layout, /env\.features\.creditScoring/);
  assert.match(layout, /notFound\(\)/);
  assert.doesNotMatch(layout, /"use client"/);
});

test(".env.example documents the flag, off", () => {
  assert.match(read(".env.example"), /^NEXT_PUBLIC_ENABLE_CREDIT_SCORING=false$/m);
});

test("Opening Balances sits under Accounting, after Period Closing, for accounting:settings", () => {
  const accounting = SIDEBAR_NAV.find((item) => item.href === "/accounting");
  assert.ok(accounting?.children, "Accounting has children");
  const hrefs = accounting.children.map((child) => child.href);
  const at = hrefs.indexOf("/accounting/opening-balances");
  assert.equal(hrefs[at - 1], "/accounting/period-closing");
  assert.deepEqual(accounting.children[at], {
    title: "Opening Balances",
    href: "/accounting/opening-balances",
    permission: "accounting:settings",
  });
});

test("Allowance for Credit Losses sits under Accounting, after Opening Balances, for accounting:view", () => {
  const accounting = SIDEBAR_NAV.find((item) => item.href === "/accounting");
  assert.ok(accounting?.children, "Accounting has children");
  const hrefs = accounting.children.map((child) => child.href);
  const at = hrefs.indexOf("/accounting/allowance");
  assert.equal(hrefs[at - 1], "/accounting/opening-balances");
  assert.deepEqual(accounting.children[at], {
    title: "Allowance for Credit Losses",
    href: "/accounting/allowance",
    permission: "accounting:view",
  });
});

test("the Allowance for Credit Losses page exists and opens on accounting:view", () => {
  const page = read("src/app/(app)/accounting/allowance/page.tsx");
  assert.match(page, /<RouteGuard permission="accounting:view"/);
});

test("CDA Compliance is off when the flag isn't set, and its routes answer not found", () => {
  assert.equal(env.features.cda, false);
  assert.equal(SIDEBAR_NAV.some((item) => item.href === "/cda"), false);
  assert.match(read("src/config/env.ts"), /process\.env\.NEXT_PUBLIC_ENABLE_CDA/);
  assert.match(read(".env.example"), /^NEXT_PUBLIC_ENABLE_CDA=false$/m);
  const layout = read("src/app/(app)/cda/layout.tsx");
  assert.match(layout, /env\.features\.cda/);
  assert.match(layout, /notFound\(\)/);
  assert.doesNotMatch(layout, /"use client"/);
});

test("the CDA menu needs cda:view and every branch, and hides the restricted reports", () => {
  const holds = (...held: string[]) => (p: string) => held.includes(p);
  assert.equal(navItemAllowed(CDA_NAV, holds("cda:view")), false);
  assert.equal(navItemAllowed(CDA_NAV, holds("branches:view_all")), false);
  assert.equal(navItemAllowed(CDA_NAV, holds("cda:view", "branches:view_all")), true);
  const restricted = Object.fromEntries((CDA_NAV.children ?? []).filter((c) => c.permission).map((c) => [c.href, c.permission]));
  assert.deepEqual(restricted, {
    "/cda/financial-statements": "cda:view_audit",
    "/cda/performance-audit": "cda:view_audit",
    "/cda/mediation": "cda:view_mediation",
    "/cda/tax-reports": "cda:view_tax",
  });
});

test("every CDA menu link has a page", () => {
  for (const child of CDA_NAV.children ?? []) {
    const path = `src/app/(app)${child.href}/page.tsx`;
    assert.equal(existsSync(resolve(process.cwd(), path)), true, path);
  }
});

test("a section without alsoRequires opens on its permission alone", () => {
  const item = SIDEBAR_NAV.find((i) => i.href === "/reports");
  assert.ok(item);
  assert.equal(navItemAllowed(item, (p) => p === "reports:view"), true);
});

test("the Member Portal is off when the flag isn't set, and its staff routes answer not found", () => {
  assert.equal(env.features.memberPortal, false);
  assert.equal(SIDEBAR_NAV.some((item) => item.href === "/member-portal"), false);
  const settings = SIDEBAR_NAV.find((item) => item.href === "/settings");
  assert.equal(settings?.children?.some((c) => c.href === "/settings/member-portal"), false);
  assert.match(read("src/config/env.ts"), /process\.env\.NEXT_PUBLIC_ENABLE_MEMBER_PORTAL/);
  assert.match(read(".env.example"), /^NEXT_PUBLIC_ENABLE_MEMBER_PORTAL=false$/m);
  for (const layout of ["src/app/(app)/member-portal/layout.tsx", "src/app/(app)/settings/member-portal/layout.tsx"]) {
    const text = read(layout);
    assert.match(text, /env\.features\.memberPortal/, layout);
    assert.match(text, /notFound\(\)/, layout);
    assert.doesNotMatch(text, /"use client"/, layout);
  }
});

test("the Member Portal menu opens on any of its three page permissions, each page on its own", () => {
  const holds = (...held: string[]) => (p: string) => held.includes(p);
  assert.equal(navItemAllowed(MEMBER_PORTAL_NAV, holds()), false);
  assert.equal(navItemAllowed(MEMBER_PORTAL_NAV, holds("member_portal:settings")), false);
  for (const p of ["member_portal:view", "member_portal:requests", "member_portal:announcements"]) {
    assert.equal(navItemAllowed(MEMBER_PORTAL_NAV, holds(p)), true, p);
  }
  assert.deepEqual(
    (MEMBER_PORTAL_NAV.children ?? []).map((c) => [c.href, c.permission]),
    [
      ["/member-portal", "member_portal:view"],
      ["/member-portal/requests", "member_portal:requests"],
      ["/member-portal/announcements", "member_portal:announcements"],
    ],
  );
});

test("each Member Portal staff page is guarded by the permission its menu entry names", () => {
  const pages: [string, string][] = [
    ["src/app/(app)/member-portal/page.tsx", "member_portal:view"],
    ["src/app/(app)/member-portal/requests/page.tsx", "member_portal:requests"],
    ["src/app/(app)/member-portal/requests/[id]/page.tsx", "member_portal:requests"],
    ["src/app/(app)/member-portal/announcements/page.tsx", "member_portal:announcements"],
    ["src/app/(app)/settings/member-portal/page.tsx", "member_portal:settings"],
  ];
  for (const [page, permission] of pages) {
    assert.match(read(page), new RegExp(`<RouteGuard permission="${permission}"`), page);
  }
});

test("the staff notice links lead to pages that exist", () => {
  // RequestAlerts links `/member-portal/requests/{id}`; PortalStaffAlerts `/borrowers/{id}`.
  assert.equal(existsSync(resolve(process.cwd(), "src/app/(app)/member-portal/requests/[id]/page.tsx")), true);
  assert.equal(existsSync(resolve(process.cwd(), "src/app/(app)/borrowers/[id]/page.tsx")), true);
});

test("the Member Portal's own link opens the first page the user can open", () => {
  const holds = (...held: string[]) => (p: string) => held.includes(p);
  assert.equal(navItemHref(MEMBER_PORTAL_NAV, holds("member_portal:view", "member_portal:requests")), "/member-portal");
  assert.equal(navItemHref(MEMBER_PORTAL_NAV, holds("member_portal:requests")), "/member-portal/requests");
  assert.equal(navItemHref(MEMBER_PORTAL_NAV, holds("member_portal:announcements")), "/member-portal/announcements");
  assert.equal(navItemHref(CDA_NAV, holds("cda:view")), "/cda");
});

test("Settings → Member Portal also needs every branch, as its page does", () => {
  const holds = (...held: string[]) => (p: string) => held.includes(p);
  const child = { title: "Member Portal", href: "/settings/member-portal", permission: "member_portal:settings" as const, alsoRequires: ["branches:view_all" as const] };
  assert.equal(navChildAllowed(child, holds("member_portal:settings")), false);
  assert.equal(navChildAllowed(child, holds("member_portal:settings", "branches:view_all")), true);
  assert.equal(navChildAllowed({ title: "Profile", href: "/settings/profile" }, holds()), true);
});
