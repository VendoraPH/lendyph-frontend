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

test("the slice adds no top-level AMLA section: later slices add theirs with their pages", () => {
  assert.equal(nav.SIDEBAR_NAV.some((item) => item.href.startsWith("/amla")), false);
});

test("the AMLA settings link has a page", () => {
  assert.equal(existsSync(resolve(process.cwd(), "src/app/(app)/settings/amla/page.tsx")), true);
});
