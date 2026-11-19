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

test("it holds Customers and an AMLA Settings link, nothing a later slice builds", () => {
  assert.deepEqual(
    (nav.AMLA_NAV.children ?? []).map((c) => [c.title, c.href]),
    [
      ["Customers", "/amla/customers"],
      ["AMLA Settings", "/settings/amla"],
    ],
  );
});

test("Customers needs amla:cdd, plus amla:view for the AMLA pages, as its endpoints and the /amla guard do", () => {
  const customers = (nav.AMLA_NAV.children ?? [])[0];
  assert.equal(nav.navChildAllowed(customers, holds("amla:cdd", "amla:view")), true);
  assert.equal(nav.navChildAllowed(customers, holds("amla:view")), false);
  assert.equal(nav.navChildAllowed(customers, holds("amla:cdd")), false);
});

test("AMLA Settings opens as Settings → AMLA does, so the Compliance Officer has a menu path without settings:view", () => {
  const link = (nav.AMLA_NAV.children ?? [])[1];
  assert.equal(nav.navChildAllowed(link, holds("amla:settings")), true);
  assert.equal(nav.navChildAllowed(link, holds("amla:audit")), true);
  assert.equal(nav.navChildAllowed(link, holds("amla:view")), true);
  assert.equal(nav.navChildAllowed(link, holds("amla:cdd")), false);
});

test("the section's own link opens the first page the user can open", () => {
  assert.equal(nav.navItemHref(nav.AMLA_NAV, holds("amla:view", "amla:cdd")), "/amla/customers");
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
