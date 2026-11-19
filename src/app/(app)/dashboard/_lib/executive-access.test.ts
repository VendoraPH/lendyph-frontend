/**
 * The Executive Dashboard needs `dashboard:analytics` (Phase 6 decision 4), on
 * top of its build flag. Layouts and pages are components, which `tsx --test`
 * doesn't render, so their wiring is read from source.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Permission } from "@/types";
import { EXECUTIVE_DASHBOARD_PERMISSION, showExecutiveLink } from "./executive-access";

const read = (path: string) => readFileSync(join(import.meta.dirname, "..", path), "utf8");

test("the executive page's permission is dashboard:analytics", () => {
  assert.equal(EXECUTIVE_DASHBOARD_PERMISSION, "dashboard:analytics");
});

test("the Dashboard's link shows only with the flag on and dashboard:analytics held", () => {
  const holder = (p: Permission) => p === EXECUTIVE_DASHBOARD_PERMISSION;
  const viewer = (p: Permission) => p === "dashboard:view";
  assert.equal(showExecutiveLink(true, holder), true);
  assert.equal(showExecutiveLink(true, viewer), false);
  assert.equal(showExecutiveLink(false, holder), false);
  assert.equal(showExecutiveLink(false, viewer), false);
});

test("the route is guarded on its layout, inside the flag check that answers not found", () => {
  const layout = read("executive/layout.tsx");
  const flag = layout.indexOf("if (!env.features.executiveDashboard) notFound();");
  const guard = layout.indexOf("<RouteGuard permission={EXECUTIVE_DASHBOARD_PERMISSION}");
  assert.ok(flag > -1, "the flag check stays");
  assert.ok(guard > flag, "the guard comes after the flag check");
  assert.match(layout, /<RouteGuard permission=\{EXECUTIVE_DASHBOARD_PERMISSION\} pageName="Executive Dashboard">\s*\{children\}\s*<\/RouteGuard>/);
});

test("the Dashboard's link is decided by showExecutiveLink", () => {
  const page = read("page.tsx");
  assert.match(page, /showExecutiveLink\(env\.features\.executiveDashboard, can\)/);
});
