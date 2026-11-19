import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Permission } from "@/types";
import {
  AMLA_ROUTE_PERMISSION,
  AMLA_SETTINGS_PAGE_PERMISSIONS,
  amlaChangeRequestActions,
  amlaRouteDecision,
  amlaSettingsSections,
} from "./access";

const holds = (...held: string[]) => (p: Permission) => held.includes(p);
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("the AMLA routes answer not found with the flag off, whatever the user holds", () => {
  assert.equal(amlaRouteDecision(false, holds("amla:view")), "not_found");
  assert.equal(amlaRouteDecision(false, holds()), "not_found");
});

test("with the flag on, the AMLA routes open on amla:view and refuse everyone else", () => {
  assert.equal(AMLA_ROUTE_PERMISSION, "amla:view");
  assert.equal(amlaRouteDecision(true, holds("amla:view")), "open");
  assert.equal(amlaRouteDecision(true, holds("amla:settings", "amla:audit", "branches:view_all")), "denied");
  assert.equal(amlaRouteDecision(true, holds()), "denied");
});

test("the /amla layout makes that decision: not found on the server, then the amla:view guard", () => {
  const layout = read("src/app/(app)/amla/layout.tsx");
  assert.match(layout, /if \(!env\.features\.amla\) notFound\(\);/);
  assert.match(layout, /<RouteGuard permission=\{AMLA_ROUTE_PERMISSION\}/);
  assert.doesNotMatch(layout, /"use client"/);
});

test("Settings → AMLA opens on any key one of its parts needs, as its page guard says", () => {
  assert.deepEqual([...AMLA_SETTINGS_PAGE_PERMISSIONS], ["amla:view", "amla:settings", "amla:audit"]);
  const page = read("src/app/(app)/settings/amla/page.tsx");
  assert.match(page, /<RouteGuard permission=\{\[\.\.\.AMLA_SETTINGS_PAGE_PERMISSIONS\]\}/);
});

test("amla:view alone sees the status, the calendar and the deadline preview, nothing company-wide", () => {
  assert.deepEqual(amlaSettingsSections(holds("amla:view")), {
    status: true,
    settings: false,
    versions: false,
    changeRequests: false,
    calendar: true,
    calendarRequests: false,
    log: false,
  });
});

test("the settings in force need amla:view or amla:settings, plus every branch", () => {
  assert.equal(amlaSettingsSections(holds("amla:view", "branches:view_all")).settings, true);
  assert.equal(amlaSettingsSections(holds("amla:settings", "branches:view_all")).settings, true);
  assert.equal(amlaSettingsSections(holds("amla:settings")).settings, false);
  assert.equal(amlaSettingsSections(holds("amla:audit", "branches:view_all")).settings, false);
});

test("the history needs amla:settings or amla:audit, plus every branch", () => {
  assert.equal(amlaSettingsSections(holds("amla:audit", "branches:view_all")).versions, true);
  assert.equal(amlaSettingsSections(holds("amla:settings", "branches:view_all")).versions, true);
  assert.equal(amlaSettingsSections(holds("amla:view", "branches:view_all")).versions, false);
  assert.equal(amlaSettingsSections(holds("amla:audit")).versions, false);
});

test("change requests and calendar requests need amla:settings plus every branch", () => {
  const holder = amlaSettingsSections(holds("amla:settings", "amla:view", "branches:view_all"));
  assert.equal(holder.changeRequests, true);
  assert.equal(holder.calendarRequests, true);
  assert.equal(amlaSettingsSections(holds("amla:settings", "amla:view")).changeRequests, false);
  assert.equal(amlaSettingsSections(holds("amla:settings", "amla:view")).calendarRequests, false);
});

test("the calendar is read with amla:view, so a settings holder without it asks from the requests list only", () => {
  const sections = amlaSettingsSections(holds("amla:settings", "branches:view_all"));
  assert.equal(sections.calendar, false);
  assert.equal(sections.status, false);
  assert.equal(sections.changeRequests, true);
});

test("the AMLA log is for amla:audit holders with every branch only", () => {
  assert.equal(amlaSettingsSections(holds("amla:audit", "branches:view_all")).log, true);
  assert.equal(amlaSettingsSections(holds("amla:audit")).log, false);
  assert.equal(amlaSettingsSections(holds("amla:settings", "amla:view", "branches:view_all")).log, false);
});

const holder = holds("amla:settings", "branches:view_all");
const pending = { status: "pending", requested_by: { id: 7, name: "Ana Cruz" } };

test("the maker may only withdraw their own waiting request", () => {
  assert.deepEqual(amlaChangeRequestActions(pending, 7, holder), { approve: false, reject: false, withdraw: true });
});

test("another settings holder may approve or reject, never withdraw", () => {
  assert.deepEqual(amlaChangeRequestActions(pending, 8, holder), { approve: true, reject: true, withdraw: false });
});

test("a decided request offers nothing", () => {
  for (const status of ["approved", "rejected", "withdrawn"]) {
    assert.deepEqual(amlaChangeRequestActions({ ...pending, status }, 8, holder), {
      approve: false,
      reject: false,
      withdraw: false,
    });
  }
});

test("without amla:settings and every branch, or without a signed-in user, nothing is offered", () => {
  const none = { approve: false, reject: false, withdraw: false };
  assert.deepEqual(amlaChangeRequestActions(pending, 8, holds("amla:settings")), none);
  assert.deepEqual(amlaChangeRequestActions(pending, 7, holds("branches:view_all", "amla:view")), none);
  assert.deepEqual(amlaChangeRequestActions(pending, null, holder), none);
});

test("a request from the system or a removed user can be decided, not withdrawn", () => {
  assert.deepEqual(amlaChangeRequestActions({ ...pending, requested_by: null }, 8, holder), {
    approve: true,
    reject: true,
    withdraw: false,
  });
});
