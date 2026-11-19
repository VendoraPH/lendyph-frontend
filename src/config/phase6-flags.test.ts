/**
 * Phase 6's two module switches, AMLA and multi-branch, stay off by default
 * like every other module flag, until their screens and the backend ship.
 * Read from source: Next inlines only a literal `process.env` read of a flag
 * into the browser bundle.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const FLAGS = [
  { feature: "amla", name: "NEXT_PUBLIC_ENABLE_AMLA" },
  { feature: "multiBranch", name: "NEXT_PUBLIC_ENABLE_MULTI_BRANCH" },
] as const;

for (const { feature, name } of FLAGS) {
  test(`${name} is read literally into env.features.${feature}`, () => {
    assert.match(
      read("src/config/env.ts"),
      new RegExp(`\\b${feature}: parseBoolEnvValue\\(process\\.env\\.${name}\\)`),
    );
  });

  test(`${name} is documented in .env.example and off there`, () => {
    assert.match(read(".env.example"), new RegExp(`^${name}=false$`, "m"));
  });

  test(`env.features.${feature} is off when ${name} is unset`, async () => {
    const { env } = await import("./env");
    assert.equal(env.features[feature], false);
  });
}
