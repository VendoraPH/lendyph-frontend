import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardKpiClasses } from "./kpi-layout";

// The KPI row the dashboard has always rendered with Linda closed or off.
const FIVE_ACROSS = "grid grid-cols-2 lg:grid-cols-5 gap-4";

const tokens = (classes: string) => classes.split(/\s+/).filter(Boolean);

test("the page is always the dashboard's size container, so the columns follow its width", () => {
  for (const lindaEnabled of [false, true]) {
    for (const lindaOpen of [false, true]) {
      const c = dashboardKpiClasses({ lindaEnabled, lindaOpen });
      assert.ok(tokens(c.page).includes("@container/dashboard"), c.page);
      assert.ok(!tokens(c.page).includes("space-y-6"), "PageFill spaces the rows; space-y would double it");
    }
  }
});

test("with Linda off or closed the KPI row stays five across", () => {
  assert.equal(dashboardKpiClasses({ lindaEnabled: false, lindaOpen: false }).grid, FIVE_ACROSS);
  assert.equal(dashboardKpiClasses({ lindaEnabled: false, lindaOpen: true }).grid, FIVE_ACROSS);
  assert.equal(dashboardKpiClasses({ lindaEnabled: true, lindaOpen: false }).grid, FIVE_ACROSS);
});

test("while Linda is open a narrow page shows three KPI cards across instead of five", () => {
  const c = dashboardKpiClasses({ lindaEnabled: true, lindaOpen: true });
  assert.match(c.grid, /(^| )lg:grid-cols-5( |$)/);
  assert.match(c.grid, /(^| )lg:@max-\[43rem\]\/dashboard:grid-cols-3( |$)/);
});

test("the two cards sit side by side only on a wide page, and share the height at fit", () => {
  const c = tokens(dashboardKpiClasses({ lindaEnabled: false, lindaOpen: false }).columns);
  for (const t of [
    "grid",
    "gap-4",
    "@min-[56rem]/dashboard:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
    "fit:flex-1",
    "fit:min-h-0",
    "fit:auto-rows-[minmax(0,1fr)]",
  ]) {
    assert.ok(c.includes(t), t);
  }
  assert.ok(!c.includes("grid-cols-2"), "below the container width the cards stack as before");
});
