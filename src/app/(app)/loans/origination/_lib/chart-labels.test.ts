/**
 * The dashboard's charts show statuses in the module's words. Recharts' own
 * category tick wraps a long label to the axis width in separate pieces, and
 * the label then reads with its words run together ("Under
 * DocumentVerification"); so every category axis draws its label on one line
 * (CategoryTick), and every status chart's rows go through the module's
 * labels (statusChartRows, stageChartRows), never the raw rows.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CHARTS = join(process.cwd(), "src/app/(app)/loans/origination/_components/dashboard/origination-charts.tsx");
const source = readFileSync(CHARTS, "utf8");

test("every category axis draws its labels on one line", () => {
  const axes = source.match(/<YAxis\b[^>]*type="category"[^>]*\/>/g) ?? [];
  assert.ok(axes.length >= 3, "the guard reads the category axes");
  for (const axis of axes) assert.match(axis, /tick=\{<CategoryTick\b/, axis);
});

test("the status charts read their rows through the module's labels", () => {
  assert.match(source, /statusChartRows\(data\.by_status\)/);
  assert.match(source, /stageChartRows\(data\.stage_times\)/);
  assert.doesNotMatch(source, /data=\{data\.(by_status|stage_times)\}/);
});
