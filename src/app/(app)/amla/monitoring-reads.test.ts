/**
 * The server logs every AMLA read, so each screen reads once per user action:
 * every monitoring read goes through `once`, and none is made on its own.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "src/app/(app)/amla/_components");
const files = readdirSync(DIR).filter((name) => name.endsWith(".tsx"));
const sources = files.map((name) => [name, readFileSync(join(DIR, name), "utf8")] as const);

test("each monitoring read is a one-shot read", () => {
  const reads = ["alerts", "alert", "ctrCandidates", "ctrCandidate", "detectionRules", "detectionRuleVersions", "riskRules"];
  for (const read of reads) {
    const callers = sources.filter(([, source]) => source.includes(`amlaMonitoringApi.${read}(`));
    assert.ok(callers.length > 0, `${read} is read somewhere`);
    for (const [name, source] of callers) {
      const calls = source.match(new RegExp(`amlaMonitoringApi\\.${read}\\(`, "g"))?.length ?? 0;
      const guarded = source.match(new RegExp(`once\\(\\(\\) => amlaMonitoringApi\\.${read}\\(`, "g"))?.length ?? 0;
      assert.equal(guarded, calls, `${name}: every ${read} read goes through once()`);
    }
  }
});

test("the dashboard never counts rows itself: it shows the server's totals", () => {
  const [, dashboard] = sources.find(([name]) => name === "amla-dashboard.tsx") ?? [];
  assert.ok(dashboard, "the dashboard exists");
  assert.match(dashboard, /meta\.total/);
  assert.doesNotMatch(dashboard, /\.length\b/);
  assert.doesNotMatch(dashboard, /\.reduce\(/);
});
