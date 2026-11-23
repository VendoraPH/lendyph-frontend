/**
 * Settings → AMLA with NEXT_PUBLIC_ENABLE_AMLA on. The flag is read when
 * `@/config/env` loads, so it is set before the menu is imported; each test
 * file runs in its own process, so it goes no further than this file. The
 * flag-off case is in navigation.test.ts.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Permission } from "@/types";

let nav: typeof import("./navigation");

before(async () => {
  process.env.NEXT_PUBLIC_ENABLE_AMLA = "true";
  nav = await import("./navigation");
});

const holds = (...held: string[]) => (p: Permission) => held.includes(p);
const settingsChildren = () => nav.SIDEBAR_NAV.find((item) => item.href === "/settings")?.children ?? [];

test("with the flag on, Settings lists AMLA, after Linda's place and before Data Import", () => {
  const hrefs = settingsChildren().map((child) => child.href);
  assert.ok(hrefs.includes("/settings/amla"));
  assert.ok(hrefs.indexOf("/settings/amla") < hrefs.indexOf("/settings/data-import"));
  assert.equal(settingsChildren().find((c) => c.href === "/settings/amla"), nav.AMLA_SETTINGS_NAV);
  assert.equal(nav.AMLA_SETTINGS_NAV.title, "AMLA");
});

test("Settings → AMLA shows for any AMLA key whose part of the page the server answers", () => {
  const item = nav.AMLA_SETTINGS_NAV;
  assert.equal(nav.navChildAllowed(item, holds()), false);
  assert.equal(nav.navChildAllowed(item, holds("settings:view", "branches:view_all")), false);
  assert.equal(nav.navChildAllowed(item, holds("amla:alerts")), false);
  assert.equal(nav.navChildAllowed(item, holds("amla:view")), true);
  assert.equal(nav.navChildAllowed(item, holds("amla:settings")), true);
  assert.equal(nav.navChildAllowed(item, holds("amla:audit")), true);
});

test("with the flag on, the menu has an AMLA Compliance section, after CDA Compliance's place", () => {
  const at = nav.SIDEBAR_NAV.indexOf(nav.AMLA_NAV);
  assert.ok(at > 0);
  assert.equal(nav.AMLA_NAV.title, "AMLA Compliance");
  assert.equal(nav.AMLA_NAV.href, "/amla");
  assert.ok(at < nav.SIDEBAR_NAV.findIndex((item) => item.href === "/accounting"));
});

test("the AMLA Compliance section shows for any of amla:view, amla:settings or amla:audit", () => {
  const section = nav.AMLA_NAV;
  assert.equal(nav.navItemAllowed(section, holds()), false);
  assert.equal(nav.navItemAllowed(section, holds("amla:cdd")), false);
  assert.equal(nav.navItemAllowed(section, holds("amla:view")), true);
  assert.equal(nav.navItemAllowed(section, holds("amla:settings")), true);
  assert.equal(nav.navItemAllowed(section, holds("amla:audit")), true);
});

const child = (href: string) => {
  const found = (nav.AMLA_NAV.children ?? []).find((c) => c.href === href);
  assert.ok(found, href);
  return found;
};

test("it holds the monitoring pages, Customers, Screening, the Orders Register, Risk Rules, the cases and filings pages, the reports and an AMLA Settings link, in that order", () => {
  assert.deepEqual(
    (nav.AMLA_NAV.children ?? []).map((c) => [c.title, c.href]),
    [
      ["AMLA Dashboard", "/amla"],
      ["Alerts", "/amla/alerts"],
      ["CTR Candidates", "/amla/ctr-candidates"],
      ["Transaction Monitoring", "/amla/monitoring"],
      ["Customers", "/amla/customers"],
      ["Screening", "/amla/screening"],
      ["Orders Register", "/amla/orders"],
      ["Risk Rules", "/amla/risk-rules"],
      ["Compliance Cases", "/amla/cases"],
      ["Suspicious Transactions (STR)", "/amla/str"],
      ["Covered Transactions (CTR)", "/amla/ctr"],
      ["Regulatory Submissions", "/amla/submissions"],
      ["AMLA Reports", "/amla/reports"],
      ["Audit & Compliance History", "/amla/history"],
      ["AMLA Settings", "/settings/amla"],
    ],
  );
});

test("Screening needs amla:screening with every branch, under amla:view, as its endpoints do", () => {
  assert.equal(nav.navChildAllowed(child("/amla/screening"), holds("amla:screening", "amla:view", "branches:view_all")), true);
  assert.equal(nav.navChildAllowed(child("/amla/screening"), holds("amla:screening", "amla:view")), false);
  assert.equal(nav.navChildAllowed(child("/amla/screening"), holds("amla:view", "branches:view_all")), false);
});

test("the Orders Register needs amla:sanctions with every branch, under amla:view", () => {
  assert.equal(nav.navChildAllowed(child("/amla/orders"), holds("amla:sanctions", "amla:view", "branches:view_all")), true);
  assert.equal(nav.navChildAllowed(child("/amla/orders"), holds("amla:sanctions", "amla:view")), false);
  assert.equal(nav.navChildAllowed(child("/amla/orders"), holds("amla:screening", "amla:view", "branches:view_all")), false);
});

test("the dashboard opens on amla:view, as the /amla guard does", () => {
  assert.equal(nav.navChildAllowed(child("/amla"), holds("amla:view")), true);
  assert.equal(nav.navChildAllowed(child("/amla"), holds("amla:settings")), false);
});

test("Alerts and CTR Candidates need their own keys, plus amla:view for the AMLA pages", () => {
  assert.equal(nav.navChildAllowed(child("/amla/alerts"), holds("amla:alerts", "amla:view")), true);
  assert.equal(nav.navChildAllowed(child("/amla/alerts"), holds("amla:view")), false);
  assert.equal(nav.navChildAllowed(child("/amla/alerts"), holds("amla:alerts")), false);
  assert.equal(nav.navChildAllowed(child("/amla/ctr-candidates"), holds("amla:ctr", "amla:view")), true);
  assert.equal(nav.navChildAllowed(child("/amla/ctr-candidates"), holds("amla:alerts", "amla:view")), false);
});

test("Transaction Monitoring shows the rules in force, so it is head office only", () => {
  assert.equal(nav.navChildAllowed(child("/amla/monitoring"), holds("amla:view", "branches:view_all")), true);
  assert.equal(nav.navChildAllowed(child("/amla/monitoring"), holds("amla:view", "amla:alerts")), false);
});

test("Risk Rules needs amla:cdd, amla:settings or amla:audit, with every branch, as its endpoint does", () => {
  for (const key of ["amla:cdd", "amla:settings", "amla:audit"]) {
    assert.equal(nav.navChildAllowed(child("/amla/risk-rules"), holds(key, "amla:view", "branches:view_all")), true, key);
    assert.equal(nav.navChildAllowed(child("/amla/risk-rules"), holds(key, "amla:view")), false, key);
  }
  assert.equal(nav.navChildAllowed(child("/amla/risk-rules"), holds("amla:view", "branches:view_all")), false);
});

test("Customers needs amla:cdd, plus amla:view for the AMLA pages, as its endpoints and the /amla guard do", () => {
  const customers = child("/amla/customers");
  assert.equal(nav.navChildAllowed(customers, holds("amla:cdd", "amla:view")), true);
  assert.equal(nav.navChildAllowed(customers, holds("amla:view")), false);
  assert.equal(nav.navChildAllowed(customers, holds("amla:cdd")), false);
});

test("Compliance Cases needs amla:cases with every branch, as the case routes do", () => {
  const cases = child("/amla/cases");
  assert.equal(nav.navChildAllowed(cases, holds("amla:cases", "amla:view", "branches:view_all")), true);
  assert.equal(nav.navChildAllowed(cases, holds("amla:cases", "amla:view")), false);
  assert.equal(nav.navChildAllowed(cases, holds("amla:alerts", "amla:view", "branches:view_all")), false);
});

test("STRs open on an STR reading key with every branch; CTRs on a CTR reading key in the caller's branches", () => {
  for (const key of ["amla:str", "amla:approve", "amla:submit", "amla:export"]) {
    assert.equal(nav.navChildAllowed(child("/amla/str"), holds(key, "amla:view", "branches:view_all")), true, key);
    assert.equal(nav.navChildAllowed(child("/amla/str"), holds(key, "amla:view")), false, key);
  }
  assert.equal(nav.navChildAllowed(child("/amla/str"), holds("amla:ctr", "amla:view", "branches:view_all")), false);
  for (const key of ["amla:ctr", "amla:approve", "amla:submit", "amla:export"]) {
    assert.equal(nav.navChildAllowed(child("/amla/ctr"), holds(key, "amla:view")), true, key);
  }
  assert.equal(nav.navChildAllowed(child("/amla/ctr"), holds("amla:str", "amla:view")), false);
});

test("Regulatory Submissions opens on any reporting key; Audit & Compliance History on amla:audit with every branch", () => {
  for (const key of ["amla:ctr", "amla:str", "amla:approve", "amla:submit", "amla:export"]) {
    assert.equal(nav.navChildAllowed(child("/amla/submissions"), holds(key, "amla:view")), true, key);
  }
  assert.equal(nav.navChildAllowed(child("/amla/submissions"), holds("amla:cases", "amla:view")), false);
  assert.equal(nav.navChildAllowed(child("/amla/history"), holds("amla:audit", "amla:view", "branches:view_all")), true);
  assert.equal(nav.navChildAllowed(child("/amla/history"), holds("amla:audit", "amla:view")), false);
});

test("AMLA Settings opens as Settings → AMLA does, so the Compliance Officer has a menu path without settings:view", () => {
  const link = child("/settings/amla");
  assert.equal(nav.navChildAllowed(link, holds("amla:settings")), true);
  assert.equal(nav.navChildAllowed(link, holds("amla:audit")), true);
  assert.equal(nav.navChildAllowed(link, holds("amla:view")), true);
  assert.equal(nav.navChildAllowed(link, holds("amla:cdd")), false);
});

test("the section's own link opens the first page the user can open", () => {
  assert.equal(nav.navItemHref(nav.AMLA_NAV, holds("amla:view", "amla:cdd")), "/amla");
  assert.equal(nav.navItemHref(nav.AMLA_NAV, holds("amla:settings")), "/settings/amla");
});

test("every AMLA Compliance link has a page", () => {
  for (const child of nav.AMLA_NAV.children ?? []) {
    const path = `src/app/(app)${child.href}/page.tsx`;
    assert.equal(existsSync(resolve(process.cwd(), path)), true, path);
  }
});

test("the AMLA settings link has a page", () => {
  assert.equal(existsSync(resolve(process.cwd(), "src/app/(app)/settings/amla/page.tsx")), true);
});

test("AMLA Reports shows under amla:view; the server lists only the reports the caller may open", () => {
  assert.equal(nav.navChildAllowed(child("/amla/reports"), holds("amla:view")), true);
  assert.equal(nav.navChildAllowed(child("/amla/reports"), holds("amla:export")), false);
});
