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

test("every card's figure sits at the top, so the figures line up whatever a card adds under them", () => {
  // The Collected card adds the insurance premium line under its figure.
  // Centring each card's content lifted that figure above the other cards'.
  const { content, grid } = dashboardKpiClasses();
  assert.ok(tokens(content).includes("justify-start"), content);
  assert.ok(!tokens(content).includes("justify-center"), content);
  // Three plus two: the second row's cards match the first row's height.
  assert.ok(tokens(grid).includes("auto-rows-fr"), grid);
});

test("every card's figure row is as tall as a sparkline, so a card without one keeps its figure level", () => {
  // The figure and label are centred against the 40px sparkline (Sparkline's
  // height). Share Capital has no sparkline, so its row was shorter and its
  // figure sat about 2px higher than the others at 1920 wide.
  const { row } = dashboardKpiClasses();
  for (const t of ["flex", "items-center", "justify-between", "min-h-10"]) assert.ok(tokens(row).includes(t), t);
});
