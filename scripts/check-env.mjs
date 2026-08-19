#!/usr/bin/env node
/**
 * Guards the two ways this project's env has actually broken.
 *
 * 1. A NEXT_PUBLIC_* var gets used in src/ but never documented, so the next
 *    deployment has no way to know it needs setting. (--docs-only, runs in CI.)
 * 2. A deployment builds without a required var, silently baking a localhost
 *    default into the bundle. The deploy goes green and one tenant breaks in
 *    front of a client. (Runs as `prebuild`, so every `npm run build` is gated
 *    on all five boxes without touching any deploy script.)
 *
 * Dependency-free on purpose: it must run before install-time tooling is a
 * given, and on a box where only node is guaranteed.
 */
import { readFileSync, existsSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname: the checkout path can contain spaces, which
// pathname percent-encodes into a directory that does not exist.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const docsOnly = process.argv.includes("--docs-only");
const VAR = /NEXT_PUBLIC_[A-Z0-9_]+/g;

const fail = (lines) => {
  console.error("\n  env check failed\n");
  for (const l of lines) console.error(`  ${l}`);
  console.error("");
  process.exit(1);
};

/** Keys declared in a .env-style file. */
const keysOf = (path) =>
  existsSync(path)
    ? new Set(
        readFileSync(path, "utf8")
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("#") && l.includes("="))
          .map((l) => l.slice(0, l.indexOf("=")).trim())
      )
    : null;

/** Every NEXT_PUBLIC_* referenced anywhere under src/. */
const usedInSource = () => {
  const found = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if ([".ts", ".tsx", ".js", ".jsx"].includes(extname(p)))
        for (const m of readFileSync(p, "utf8").matchAll(VAR)) found.add(m[0]);
    }
  };
  walk(join(ROOT, "src"));
  return found;
};

/**
 * The required list lives in src/config/env.ts. Parsed rather than duplicated —
 * two hand-maintained copies of this list would drift, which is the exact class
 * of bug this script exists to prevent.
 */
const requiredVars = () => {
  const src = readFileSync(join(ROOT, "src/config/env.ts"), "utf8");
  const block = src.match(/REQUIRED_IN_PRODUCTION\s*=\s*\[([^\]]*)\]/s);
  if (!block) fail(["Could not find REQUIRED_IN_PRODUCTION in src/config/env.ts."]);
  return [...block[1].matchAll(VAR)].map((m) => m[0]);
};

// --- 1. every used var is documented ---------------------------------------
const documented = keysOf(join(ROOT, ".env.example"));
if (!documented) fail([".env.example is missing — it is the contract every deployment builds against."]);

const undocumented = [...usedInSource()].filter((k) => !documented.has(k)).sort();
if (undocumented.length) {
  fail([
    "These NEXT_PUBLIC_* vars are used in src/ but absent from .env.example:",
    "",
    ...undocumented.map((k) => `  - ${k}`),
    "",
    "Add them, with the value a local dev would use. A deployment cannot set",
    "what it has never been told about.",
  ]);
}

if (docsOnly) {
  console.log(`env check: ${documented.size} vars documented, all used vars accounted for.`);
  process.exit(0);
}

// --- 2. required vars are actually set for this build ----------------------
const local = keysOf(join(ROOT, ".env.local"));
const dotenv = keysOf(join(ROOT, ".env"));
const isSet = (k) =>
  (process.env[k] !== undefined && process.env[k] !== "") ||
  local?.has(k) ||
  dotenv?.has(k);

const missing = requiredVars().filter((k) => !isSet(k));
if (missing.length) {
  fail([
    "This build is missing vars that every deployment must set:",
    "",
    ...missing.map((k) => `  - ${k}`),
    "",
    "Their code defaults are localhost values, so building without them would",
    "bake a broken URL into the bundle and still exit 0. NEXT_PUBLIC_* is inlined",
    "at build time — setting them after the build has no effect.",
    "",
    existsSync(join(ROOT, ".env"))
      ? "Add them to .env."
      : "Working locally? `cp .env.example .env` sets all of them to local defaults.",
  ]);
}

console.log(`env check: ${documented.size} documented, ${requiredVars().length} required vars present.`);
