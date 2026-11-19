import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Permission } from "@/types";
import { AMLA_ALERTS_PERMISSION, AMLA_CTR_PERMISSION, amlaAlertActions, amlaMonitoringAccess, amlaRecordId } from "./monitoring-access";

const holds = (...held: string[]) => (p: Permission) => held.includes(p);
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("alerts need amla:alerts and CTR candidates amla:ctr, each under the /amla guard's amla:view", () => {
  assert.equal(AMLA_ALERTS_PERMISSION, "amla:alerts");
  assert.equal(AMLA_CTR_PERMISSION, "amla:ctr");
  assert.equal(amlaMonitoringAccess(holds("amla:view", "amla:alerts")).alerts, true);
  assert.equal(amlaMonitoringAccess(holds("amla:alerts")).alerts, false);
  assert.equal(amlaMonitoringAccess(holds("amla:view", "amla:ctr")).ctr, true);
  assert.equal(amlaMonitoringAccess(holds("amla:view", "amla:alerts")).ctr, false);
});

test("the dashboard's parts each follow their own endpoint", () => {
  const branchUser = amlaMonitoringAccess(holds("amla:view", "amla:alerts"));
  assert.equal(branchUser.status, true);
  assert.equal(branchUser.alerts, true);
  assert.equal(branchUser.ctr, false);
});

test("the detection rules in force are for head office holding amla:view, amla:alerts or amla:settings", () => {
  assert.equal(amlaMonitoringAccess(holds("amla:view", "branches:view_all")).detectionRules, true);
  assert.equal(amlaMonitoringAccess(holds("amla:view", "amla:settings", "branches:view_all")).detectionRules, true);
  assert.equal(amlaMonitoringAccess(holds("amla:view", "amla:alerts")).detectionRules, false);
});

test("rule history and asking for a rule change need amla:settings with every branch", () => {
  const holder = amlaMonitoringAccess(holds("amla:view", "amla:settings", "branches:view_all"));
  assert.equal(holder.ruleHistory, true);
  assert.equal(holder.askRuleChange, true);
  const viewer = amlaMonitoringAccess(holds("amla:view", "amla:audit", "branches:view_all"));
  assert.equal(viewer.ruleHistory, false);
  assert.equal(viewer.askRuleChange, false);
  assert.equal(amlaMonitoringAccess(holds("amla:view", "amla:settings")).askRuleChange, false);
});

test("the risk rules are for head office holding amla:cdd, amla:settings or amla:audit", () => {
  for (const key of ["amla:cdd", "amla:settings", "amla:audit"]) {
    assert.equal(amlaMonitoringAccess(holds("amla:view", key, "branches:view_all")).riskRules, true, key);
    assert.equal(amlaMonitoringAccess(holds("amla:view", key)).riskRules, false, key);
  }
});

test("an alert's subject links to its CDD profile only for amla:cdd holders", () => {
  assert.equal(amlaMonitoringAccess(holds("amla:view", "amla:alerts", "amla:cdd")).customerLinks, true);
  assert.equal(amlaMonitoringAccess(holds("amla:view", "amla:alerts")).customerLinks, false);
});

test("each monitoring page guards on its own key before any data is read", () => {
  const guards: [string, RegExp][] = [
    ["src/app/(app)/amla/alerts/page.tsx", /<RouteGuard permission=\{AMLA_ALERTS_PERMISSION\}/],
    ["src/app/(app)/amla/alerts/[id]/page.tsx", /<RouteGuard permission=\{AMLA_ALERTS_PERMISSION\}/],
    ["src/app/(app)/amla/ctr-candidates/page.tsx", /<RouteGuard permission=\{AMLA_CTR_PERMISSION\}/],
    ["src/app/(app)/amla/ctr-candidates/[id]/page.tsx", /<RouteGuard permission=\{AMLA_CTR_PERMISSION\}/],
    ["src/app/(app)/amla/monitoring/page.tsx", /<RouteGuard permission="branches:view_all"/],
    ["src/app/(app)/amla/risk-rules/page.tsx", /<RouteGuard permission=\{\[\.\.\.AMLA_RISK_RULES_PERMISSIONS\]\}/],
  ];
  for (const [path, guard] of guards) assert.match(read(path), guard, path);
});

test("a record's route id is a positive whole number of at most 18 digits, as the server's routes take it", () => {
  assert.equal(amlaRecordId("7"), 7);
  assert.equal(amlaRecordId("123456789012345"), 123456789012345);
  for (const bad of ["0", "-1", "7a", "", "1".repeat(19), undefined, ["7"]]) {
    assert.equal(amlaRecordId(bad), null, String(bad));
  }
});

const alertOf = (status: string, assignee: number | null = null) => ({ status, assigned_to: assignee === null ? null : { id: assignee, name: "A" } });
const ALERTS = holds("amla:view", "amla:alerts");

test("a workable alert can be assigned to me, unless it is already mine", () => {
  for (const status of ["open", "assigned", "under_review"]) assert.equal(amlaAlertActions(alertOf(status), 9, ALERTS).assignToMe, true, status);
  assert.equal(amlaAlertActions(alertOf("assigned", 9), 9, ALERTS).assignToMe, false);
  assert.equal(amlaAlertActions(alertOf("open"), null, ALERTS).assignToMe, false);
});

test("review starts from open or assigned only; close from any workable status", () => {
  assert.equal(amlaAlertActions(alertOf("open"), 9, ALERTS).review, true);
  assert.equal(amlaAlertActions(alertOf("assigned"), 9, ALERTS).review, true);
  assert.equal(amlaAlertActions(alertOf("under_review"), 9, ALERTS).review, false);
  for (const status of ["open", "assigned", "under_review"]) assert.equal(amlaAlertActions(alertOf(status), 9, ALERTS).close, true, status);
});

test("escalated, closed and cleared alerts take no step, and every step needs amla:alerts under amla:view", () => {
  for (const status of ["escalated", "closed", "cleared"]) {
    assert.deepEqual(amlaAlertActions(alertOf(status), 9, ALERTS), { assignToMe: false, review: false, close: false, history: true }, status);
  }
  assert.deepEqual(amlaAlertActions(alertOf("open"), 9, holds("amla:view")), { assignToMe: false, review: false, close: false, history: false });
  assert.deepEqual(amlaAlertActions(alertOf("open"), 9, holds("amla:alerts")), { assignToMe: false, review: false, close: false, history: false });
});
