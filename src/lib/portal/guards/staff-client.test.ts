import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { SRC, memberSources } from "./sources";

// Member pages never go through the staff app's HTTP client, not even for the
// logo: no file under src/app/member/**, src/lib/portal/** or
// src/components/portal/** may reach the staff client or anything built on it
// (its services, hooks, stores or components), directly or through another
// module. The import graph is followed through `@/` and relative imports.
const STAFF_CLIENT = ["lib/axios-client.ts", "lib/api-client.ts"];

const IMPORT = /(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;

function resolveFile(base: string): string | null {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function importsOf(path: string): string[] {
  const text = readFileSync(path, "utf8");
  const found: string[] = [];
  for (const match of text.matchAll(IMPORT)) {
    const spec = match[1] ?? match[2] ?? match[3];
    if (!spec) continue;
    const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? join(dirname(path), spec) : null;
    const file = base ? resolveFile(base) : null;
    if (file) found.push(file);
  }
  return found;
}

/** The chain of imports from `start` to a staff client file, or null. */
function pathToStaffClient(start: string): string[] | null {
  const seen = new Set<string>([start]);
  const queue: string[][] = [[start]];
  while (queue.length > 0) {
    const chain = queue.shift()!;
    for (const next of importsOf(chain[chain.length - 1])) {
      if (seen.has(next)) continue;
      seen.add(next);
      const path = [...chain, next];
      if (STAFF_CLIENT.includes(relative(SRC, next))) return path.map((p) => relative(SRC, p));
      queue.push(path);
    }
  }
  return null;
}

for (const { file } of memberSources()) {
  test(`${file} never reaches the staff API client`, () => {
    assert.equal(pathToStaffClient(join(SRC, file))?.join(" → ") ?? null, null);
  });
}

test("the scan finds a staff client behind another module", () => {
  const brandLogo = join(SRC, "components/common/brand-logo.tsx");
  assert.ok(pathToStaffClient(brandLogo), "BrandLogo reads the branding through the staff client");
  assert.ok(pathToStaffClient(join(SRC, "services/index.ts")));
});
