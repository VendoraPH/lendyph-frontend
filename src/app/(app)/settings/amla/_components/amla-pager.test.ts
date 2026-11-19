import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the AMLA pager is a pinned bar Linda's floating button keeps clear of", () => {
  const source = readFileSync(new URL("../../../../../components/amla/amla-pager.tsx", import.meta.url), "utf8");
  assert.match(source, /<nav[^>]*\bdata-fab-clear=""/);
});

test("the AMLA log reads once per user action", () => {
  const source = readFileSync(new URL("./amla-log-tab.tsx", import.meta.url), "utf8");
  assert.match(source, /once\(\(\) => amlaApi\.log\(applied\)\)/);
});
