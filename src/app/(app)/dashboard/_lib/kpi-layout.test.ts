import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DASHBOARD_PAGE_CLASS,
  DUES_DONUT_COLUMN_CLASS,
  DUES_TABS_LIST_CLASS,
  DUES_TABLE_PANEL_CLASS,
  TRANSACTIONS_TABLE_PANEL_CLASS,
  dashboardKpiClasses,
} from "./kpi-layout";

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

test("the collections ring sits in its own bordered panel at the top, level with the table's headings", () => {
  // Centred in a column as tall as the card, the ring floated below the
  // table's headings whenever the list was short ("Nothing due today"), with
  // nothing around it to show where its section ends.
  const c = tokens(DUES_DONUT_COLUMN_CLASS);
  for (const t of ["rounded-lg", "border", "p-4", "justify-start"]) assert.ok(c.includes(t), t);
  assert.ok(!c.includes("justify-center"), "justify-center");
  // Its left edge lines up with the tabs above it (mx-4); beside the table, the row's gap spaces it.
  for (const t of ["mx-4", "@xl:mr-0"]) assert.ok(c.includes(t), t);
  // Still its own fixed-width column beside the table on a wide card.
  for (const t of ["flex", "flex-col", "items-center", "shrink-0", "@xl:w-60"]) assert.ok(c.includes(t), t);
});

test("both tables sit in the same bordered panel as the ring, so the boxes share one top line", () => {
  // With only the ring boxed, its top edge lined up with the table's invisible top,
  // about 18px above "Member" and 38px above the line under the headings, so it
  // still read as out of line (Arvin, 2026-11-19, on staging).
  const ring = tokens(DUES_DONUT_COLUMN_CLASS);
  for (const cls of [DUES_TABLE_PANEL_CLASS, TRANSACTIONS_TABLE_PANEL_CLASS]) {
    const c = tokens(cls);
    for (const t of ["rounded-lg", "border", "mx-4"]) {
      assert.ok(c.includes(t), `${t} in ${cls}`);
      assert.ok(ring.includes(t), `${t} in the ring's panel too`);
    }
  }
  // Beside the ring on a wide card, the row's gap spaces the two boxes and the table takes the rest.
  assert.ok(tokens(DUES_TABLE_PANEL_CLASS).includes("@xl:ml-0"), "@xl:ml-0");
});

test("each table's panel wraps its scroll box and clips its own corners, so the expand dialog can't notch them", () => {
  // The expand dialog turns a scroll box's overflow off, so a border on the scroll
  // box itself lost its rounded clip there and the square heading row painted over
  // the top corners. The panel is now a wrapper that clips with overflow-clip: unlike
  // overflow-hidden it is no scroll container, so headings still pin to whichever
  // box scrolls (the table's on the page, the dialog's when expanded).
  for (const cls of [DUES_TABLE_PANEL_CLASS, TRANSACTIONS_TABLE_PANEL_CLASS]) {
    const c = tokens(cls);
    for (const t of ["overflow-clip", "flex", "flex-col", "flex-1", "min-h-0"]) assert.ok(c.includes(t), `${t} in ${cls}`);
    assert.ok(!c.includes("overflow-hidden"), `no overflow-hidden in ${cls}`);
  }
  const page = readFileSync(join(import.meta.dirname, "..", "page.tsx"), "utf8");
  assert.match(page, /<div className=\{DUES_TABLE_PANEL_CLASS\}>\s*<ScrollBox>\s*<DuesTable/);
  assert.match(page, /<div className=\{TRANSACTIONS_TABLE_PANEL_CLASS\}>\s*<ScrollBox>\s*<TransactionsTable/);
});

test("the ring's panel runs the table panel's height on a wide card, so both boxes end level", () => {
  // Sized to its content (self-start), the ring's panel ended after its caption
  // while the table's ran the card's full height, leaving a blank space under it
  // (Arvin, 2026-11-19: "Can we fill something in this blank space?").
  const c = tokens(DUES_DONUT_COLUMN_CLASS);
  assert.ok(c.includes("@xl:self-stretch"), "@xl:self-stretch");
  assert.ok(!c.includes("@xl:self-start"), "no @xl:self-start");
  // The ring and its list stay at the top; on a short screen the panel scrolls
  // inside its own box instead of pushing past the card.
  for (const t of ["justify-start", "@xl:min-h-0", "@xl:overflow-y-auto"]) assert.ok(c.includes(t), t);
});

test("in the expand dialog the tabs and panels start at the title's left edge", () => {
  // On the card, mx-4 restores the card's own padding (its body has px-0). The
  // dialog's body has no such inset, so the tabs began 16px right of the title.
  const inDialog = "in-data-[slot=dialog-content]:mx-0";
  for (const cls of [DUES_TABS_LIST_CLASS, DUES_DONUT_COLUMN_CLASS, DUES_TABLE_PANEL_CLASS, TRANSACTIONS_TABLE_PANEL_CLASS]) {
    const c = tokens(cls);
    assert.ok(c.includes("mx-4"), `mx-4 in ${cls}`);
    assert.ok(c.includes(inDialog), `${inDialog} in ${cls}`);
  }
  const page = readFileSync(join(import.meta.dirname, "..", "page.tsx"), "utf8");
  assert.match(page, /<TabsList className=\{DUES_TABS_LIST_CLASS\}>/);
});
