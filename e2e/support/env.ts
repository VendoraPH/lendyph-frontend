import path from "node:path";

import { config as loadEnvFile } from "dotenv";

/**
 * The e2e suite's contract with its environment.
 *
 * Three variables, none of them ever committed:
 *
 *   E2E_BASE_URL   the deployment under test. Defaults to binhs-coop staging.
 *   E2E_USERNAME   an account that holds `fees:view`. Per src/constants/rbac.ts
 *                  every `fees:*` permission is admin-only, so in practice this
 *                  has to be an admin — any other role lands on AccessDenied.
 *   E2E_PASSWORD   that account's password.
 *
 * Credentials belong in `.env.e2e.local` (gitignored, see `.env.e2e.example`)
 * or in the shell/CI secret store. When they are absent the suite SKIPS with
 * `SKIP_REASON` rather than failing: a harness that reds the moment it has no
 * secret teaches people to ignore it.
 */

// Loaded HERE rather than in playwright.config.ts so it cannot lose a race with
// module evaluation order: every consumer of these values goes through this
// file, so by the time anything reads process.env the file has been applied.
// Real environment variables win — dotenv does not override — which is what
// lets CI pass the same three vars as secrets.
loadEnvFile({ path: path.join(__dirname, "..", "..", ".env.e2e.local"), quiet: true });

const STAGING_BASE_URL = "https://binhs-coop-staging.lendyph.com";

/** Trimmed value, or "" when unset — an empty var is the same as no var here. */
function read(name: string): string {
  const raw = process.env[name];
  return typeof raw === "string" ? raw.trim() : "";
}

export const baseURL = read("E2E_BASE_URL") || STAGING_BASE_URL;
export const username = read("E2E_USERNAME");
export const password = read("E2E_PASSWORD");

/** Where `auth.setup.ts` parks the signed-in browser state for the spec projects. */
export const STORAGE_STATE = path.join(__dirname, "..", ".auth", "user.json");

const CREDENTIAL_VARS = ["E2E_USERNAME", "E2E_PASSWORD"] as const;

export const missingCredentialVars: string[] = CREDENTIAL_VARS.filter(
  (name) => read(name) === ""
);

export const hasCredentials = missingCredentialVars.length === 0;

export const SKIP_REASON =
  `e2e credentials are not set (${missingCredentialVars.join(", ") || "none missing"}). ` +
  `Set E2E_USERNAME and E2E_PASSWORD — see .env.e2e.example — and re-run. ` +
  `Target: ${baseURL}`;

/**
 * Refuse to drive a browser against production.
 *
 * Deliberately an ALLOW-list. A deny-list of prod hostnames has to be kept in
 * step with ten deployments across three clients, and the failure mode of
 * forgetting one is "the suite logs into production and clicks buttons".
 * Anything that is not visibly a staging or local host is rejected.
 */
export function assertNonProductionTarget(rawUrl: string): void {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    throw new Error(
      `E2E_BASE_URL must be an absolute URL (e.g. ${STAGING_BASE_URL}), got: ${rawUrl}`
    );
  }

  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local");

  if (isLocal || host.includes("staging")) return;

  throw new Error(
    `Refusing to run e2e tests against "${host}".\n` +
      `This suite signs in and exercises real screens, so it is restricted to staging ` +
      `and local hosts: the hostname must contain "staging" or be localhost.\n` +
      `Default target: ${STAGING_BASE_URL}`
  );
}
