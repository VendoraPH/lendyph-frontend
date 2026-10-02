import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardKpiClasses } from "./kpi-layout";

// The classes the dashboard rendered before Linda existed. Any change to them
// would change the dashboard for deployments that never turn Linda on.
const UNCHANGED = { page: "space-y-6", grid: "grid grid-cols-2 lg:grid-cols-5 gap-4" };

test("with Linda off the dashboard keeps its classes, whatever the panel state says", () => {
  assert.deepEqual(dashboardKpiClasses({ lindaEnabled: false, lindaOpen: false }), UNCHANGED);
  assert.deepEqual(dashboardKpiClasses({ lindaEnabled: false, lindaOpen: true }), UNCHANGED);
});

test("with Linda on but closed the dashboard keeps its classes", () => {
  assert.deepEqual(dashboardKpiClasses({ lindaEnabled: true, lindaOpen: false }), UNCHANGED);
});

test("while Linda is open a narrow page shows three KPI cards across instead of five", () => {
  const c = dashboardKpiClasses({ lindaEnabled: true, lindaOpen: true });
  assert.match(c.page, /(^| )@container\/dashboard( |$)/);
  assert.match(c.grid, /(^| )lg:grid-cols-5( |$)/);
  assert.match(c.grid, /(^| )lg:@max-\[43rem\]\/dashboard:grid-cols-3( |$)/);
});
