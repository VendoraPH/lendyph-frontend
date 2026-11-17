import { test } from "node:test";
import assert from "node:assert/strict";
import { DASHBOARD_PAGE_CLASS, dashboardKpiClasses } from "./kpi-layout";

const tokens = (classes: string) => classes.split(/\s+/).filter(Boolean);

test("the page is the dashboard's size container, so the KPI row follows its width", () => {
  assert.equal(DASHBOARD_PAGE_CLASS, "@container/dashboard");
});

test("the KPI row is five across on a wide page and three plus two on a narrow one", () => {
  // A narrow page: 1024px wide, or Linda's side panel open. Five cards across
  // squeezed the sparklines to slivers and wrapped the premium line 4-5 times.
  const c = tokens(dashboardKpiClasses().grid);
  for (const t of ["grid", "gap-4", "grid-cols-2", "lg:grid-cols-5", "lg:@max-[52rem]/dashboard:grid-cols-3"]) {
    assert.ok(c.includes(t), t);
  }
});

test("each KPI card is its own size container, and its sparkline shows only when the card is wide enough", () => {
  const { card, sparkline } = dashboardKpiClasses();
  assert.ok(tokens(card).includes("@container/kpi"), card);
  assert.ok(tokens(sparkline).includes("hidden"), sparkline);
  assert.ok(tokens(sparkline).includes("@min-[14rem]/kpi:block"), sparkline);
});
