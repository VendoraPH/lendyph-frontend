import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Permission } from "@/types";
import { AMLA_CUSTOMERS_PERMISSION, amlaCddAccess, amlaSubjectFromRoute, amlaSubjectHref } from "./cdd-access";

const holds = (...held: string[]) => (p: Permission) => held.includes(p);
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("the customer screens need amla:cdd, under the /amla guard's amla:view", () => {
  assert.equal(AMLA_CUSTOMERS_PERMISSION, "amla:cdd");
  assert.equal(amlaCddAccess(holds("amla:view", "amla:cdd")).customers, true);
  assert.equal(amlaCddAccess(holds("amla:cdd")).customers, false);
  assert.equal(amlaCddAccess(holds("amla:view")).customers, false);
});

test("walk-ins are head-office only: they carry no branch", () => {
  assert.equal(amlaCddAccess(holds("amla:view", "amla:cdd", "branches:view_all")).walkIns, true);
  assert.equal(amlaCddAccess(holds("amla:view", "amla:cdd")).walkIns, false);
  assert.equal(amlaCddAccess(holds("amla:view", "branches:view_all")).walkIns, false);
});

test("picking a member's own valid ID reads the member's documents, so it needs borrowers:view too", () => {
  assert.equal(amlaCddAccess(holds("amla:view", "amla:cdd", "borrowers:view")).memberIds, true);
  assert.equal(amlaCddAccess(holds("amla:view", "amla:cdd")).memberIds, false);
  assert.equal(amlaCddAccess(holds("borrowers:view")).memberIds, false);
});

test("both customer pages guard on amla:cdd before any data is read", () => {
  for (const path of ["src/app/(app)/amla/customers/page.tsx", "src/app/(app)/amla/customers/[type]/[id]/page.tsx"]) {
    assert.match(read(path), /<RouteGuard permission=\{AMLA_CUSTOMERS_PERMISSION\}/, path);
  }
});

test("a subject's route reads its type and id, as the server's routes take them", () => {
  assert.deepEqual(amlaSubjectFromRoute("members", "7"), { type: "member", segment: "members", id: 7 });
  assert.deepEqual(amlaSubjectFromRoute("walk-ins", "12"), { type: "walk_in", segment: "walk-ins", id: 12 });
});

test("any other route is not a subject", () => {
  for (const [type, id] of [
    ["borrowers", "7"],
    ["members", "0"],
    ["members", "-1"],
    ["members", "7a"],
    ["members", "1".repeat(19)],
    ["members", ""],
    [undefined, "7"],
    ["members", ["7"]],
  ] as const) {
    assert.equal(amlaSubjectFromRoute(type, id), null, `${String(type)}/${String(id)}`);
  }
});

test("a worklist row links to its subject's page", () => {
  assert.equal(amlaSubjectHref("member", 7), "/amla/customers/members/7");
  assert.equal(amlaSubjectHref("walk_in", 12), "/amla/customers/walk-ins/12");
});
