import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Permission } from "@/types";
import { SIDEBAR_NAV } from "@/constants/navigation";
import { OWN_PROFILE_HREF, accountSettingsHref } from "./account-menu";

const holds = (...keys: Permission[]) => (permission: Permission) => keys.includes(permission);
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("the account menu's Settings opens the first Settings page the user can open, as the side menu does", () => {
  assert.equal(accountSettingsHref(SIDEBAR_NAV, holds("imports:process")), "/settings/data-import");
  assert.equal(accountSettingsHref(SIDEBAR_NAV, holds("accounting:settings")), "/settings/accounting");
  assert.equal(accountSettingsHref(SIDEBAR_NAV, holds("fees:view")), "/settings/fees");
  assert.equal(accountSettingsHref(SIDEBAR_NAV, holds("settings:view")), "/settings/profile");
});

test("a user who can open no Settings page gets no Settings item", () => {
  assert.equal(accountSettingsHref(SIDEBAR_NAV, holds("loans:view", "borrowers:view")), null);
});

test("every signed-in user opens their own Profile: no permission, as GET and PATCH /auth/me need none", () => {
  assert.equal(OWN_PROFILE_HREF, "/settings/profile");
  const page = read("src/app/(app)/settings/profile/page.tsx");
  assert.doesNotMatch(page, /RouteGuard|PermissionGate|usePermission/);
  // It reads and saves only the user's own record; the role's saved name reads
  // GET /roles only with users:view (useRoleLabel).
  assert.deepEqual([...page.matchAll(/(\w+Service)\.(\w+)\(/g)].map((m) => `${m[1]}.${m[2]}`).sort(), [
    "authService.me",
    "authService.updateMe",
  ]);
  const header = read("src/components/layout/header.tsx");
  assert.match(header, /router\.push\(OWN_PROFILE_HREF\)/);
  // The menu Menu Visibility leaves (round 6), so a hidden module's settings page is never the link.
  assert.match(header, /const menu = useVisibleNav\(\);/);
  assert.match(header, /accountSettingsHref\(menu, can\)/);
  assert.doesNotMatch(header, /"\/settings\/loan-products"/);
});
