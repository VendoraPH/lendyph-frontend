import { defineConfig, devices } from "@playwright/test";

import {
  STORAGE_STATE,
  assertNonProductionTarget,
  baseURL,
  hasCredentials,
  missingCredentialVars,
} from "./e2e/support/env";

// Hard gate, evaluated before a single test is collected: this suite signs in
// and exercises real screens, so it is allowed to point at staging and local
// hosts only. See assertNonProductionTarget for why it is an allow-list.
assertNonProductionTarget(baseURL);

// TEST_WORKER_INDEX is only set inside worker processes; without this guard
// the banner prints once per worker on every run.
if (!hasCredentials && process.env.TEST_WORKER_INDEX === undefined) {
  console.warn(
    `\n  Playwright e2e: ${missingCredentialVars.join(" and ")} not set — ` +
      `the suite will SKIP rather than fail.\n` +
      `  Copy .env.e2e.example to .env.e2e.local (gitignored) and fill it in, ` +
      `or export the vars.\n  Target: ${baseURL}\n`
  );
}

/**
 * End-to-end suite. Separate from `npm run test:unit`, which is 72 pure-logic
 * `node:test` files under src/ and stays that way — these two never share a
 * runner, a glob or a process.
 *
 * There is deliberately no `webServer`: the target is a deployed environment
 * (staging), not a dev server this config is allowed to boot.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],

  // The screens under test fetch from a remote API through a Next rewrite, so
  // every budget here is "slow staging", not "fast localhost".
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },

  projects: [
    // Signs in once through the real login form and parks the session in
    // .auth/user.json. It skips itself when credentials are absent, which is
    // also why `storageState` is set on the spec project and not globally:
    // nothing reads that file unless a test is actually going to run.
    { name: "setup", testMatch: /.*\.setup\.ts$/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
    },
  ],
});
