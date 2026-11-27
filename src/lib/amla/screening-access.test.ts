import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Permission } from "@/types";
import { AMLA_SANCTIONS_PERMISSION, AMLA_SCREENING_PERMISSION, amlaReleaseActions, amlaScreeningAccess } from "./screening-access";

const holds = (...held: string[]) => (p: Permission) => held.includes(p);
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("screening needs amla:screening and orders amla:sanctions, each with every branch, under amla:view", () => {
  assert.equal(AMLA_SCREENING_PERMISSION, "amla:screening");
  assert.equal(AMLA_SANCTIONS_PERMISSION, "amla:sanctions");
  assert.equal(amlaScreeningAccess(holds("amla:view", "amla:screening", "branches:view_all")).screening, true);
  assert.equal(amlaScreeningAccess(holds("amla:view", "amla:screening")).screening, false);
  assert.equal(amlaScreeningAccess(holds("amla:screening", "branches:view_all")).screening, false);
  assert.equal(amlaScreeningAccess(holds("amla:view", "amla:sanctions", "branches:view_all")).orders, true);
  assert.equal(amlaScreeningAccess(holds("amla:view", "amla:sanctions")).orders, false);
  assert.equal(amlaScreeningAccess(holds("amla:view", "amla:screening", "branches:view_all")).orders, false);
});

test("recording an order picks its member with borrowers:view and its holds' accounts with savings:view", () => {
  const officer = amlaScreeningAccess(holds("amla:view", "amla:sanctions", "branches:view_all", "borrowers:view", "savings:view"));
  assert.equal(officer.pickMember, true);
  assert.equal(officer.pickAccounts, true);
  const bare = amlaScreeningAccess(holds("amla:view", "amla:sanctions", "branches:view_all"));
  assert.equal(bare.pickMember, false);
  assert.equal(bare.pickAccounts, false);
  assert.equal(amlaScreeningAccess(holds("borrowers:view", "savings:view")).pickMember, false);
});

test("the screening and orders pages guard on their key and every branch before any data is read", () => {
  for (const [path, key] of [
    ["src/app/(app)/amla/screening/page.tsx", "AMLA_SCREENING_PERMISSION"],
    ["src/app/(app)/amla/screening/[id]/page.tsx", "AMLA_SCREENING_PERMISSION"],
    ["src/app/(app)/amla/orders/page.tsx", "AMLA_SANCTIONS_PERMISSION"],
    ["src/app/(app)/amla/orders/[id]/page.tsx", "AMLA_SANCTIONS_PERMISSION"],
  ]) {
    const source = read(path);
    assert.match(source, new RegExp(`<RouteGuard permission=\\{${key}\\}`), path);
    assert.match(source, /<RouteGuard permission="branches:view_all"/, path);
  }
});

const holder = holds("amla:view", "amla:sanctions", "branches:view_all");
const none = { request: false, approve: false, reject: false, withdraw: false };
const order = (pending: { requested_by: { id: number; name: string } | null } | null, status = "active") => ({ status, pending_release: pending });

test("an order in force with nothing waiting can be asked to be released", () => {
  assert.deepEqual(amlaReleaseActions(order(null), 7, holder), { ...none, request: true });
});

test("the person who asked for a release only withdraws it", () => {
  assert.deepEqual(amlaReleaseActions(order({ requested_by: { id: 7, name: "Ana" } }), 7, holder), { ...none, withdraw: true });
});

test("a different amla:sanctions holder approves or rejects it, never withdraws it", () => {
  assert.deepEqual(amlaReleaseActions(order({ requested_by: { id: 7, name: "Ana" } }), 8, holder), { ...none, approve: true, reject: true });
});

test("a request from a removed user can be decided, never withdrawn", () => {
  assert.deepEqual(amlaReleaseActions(order({ requested_by: null }), 8, holder), { ...none, approve: true, reject: true });
});

test("a released order, a user without amla:sanctions and every branch, or no signed-in user, gets nothing", () => {
  assert.deepEqual(amlaReleaseActions(order(null, "released"), 7, holder), none);
  assert.deepEqual(amlaReleaseActions(order(null), 7, holds("amla:view", "amla:sanctions")), none);
  assert.deepEqual(amlaReleaseActions(order({ requested_by: { id: 7, name: "Ana" } }), 8, holds("amla:view", "branches:view_all")), none);
  assert.deepEqual(amlaReleaseActions(order(null), null, holder), none);
});

test("savings screens never name AMLA: an order's hold reads only as a legal order there", () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
    });
  for (const path of walk(resolve(process.cwd(), "src/app/(app)/savings"))) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /\bAMLA\b|amla/, path);
  }
});
