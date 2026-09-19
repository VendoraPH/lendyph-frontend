import { expect, type Page } from "@playwright/test";

import { baseURL, password, username } from "./env";

/**
 * Signing in through the real form, not by injecting a token.
 *
 * The app keeps its session in localStorage (`tokenManager` in
 * src/lib/axios-client.ts) plus a persisted zustand store holding the user and
 * their permissions, and the (app) layout renders `null` until BOTH are
 * present. Forging that pair by hand would couple the harness to two storage
 * keys and a store shape; driving the form gets the real thing, and
 * `auth.setup.ts` saves it once so specs pay for it once.
 */

const LOGIN_TIMEOUT = 45_000;
const CHANGE_PASSWORD_PATH = "/change-password";

/** Sonner's own DOM contract — the only way to read a toast, which has no role we can query. */
const ERROR_TOAST = '[data-sonner-toast][data-type="error"]';

export async function loginViaUi(page: Page): Promise<void> {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
    "The sign-in form never rendered — is E2E_BASE_URL reachable?"
  ).toBeVisible({ timeout: LOGIN_TIMEOUT });

  await page.getByLabel("Username or Email").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Race the navigation against the error toast. Waiting only for the URL would
  // spend the full timeout and then report "timed out" for what is really a
  // wrong password — the toast says so in the first second, and disappears
  // long before a bare waitForURL would give up.
  const navigated = page
    .waitForURL(/\/(dashboard|change-password)/, { timeout: LOGIN_TIMEOUT })
    .then(() => "navigated" as const);
  const rejected = page
    .locator(ERROR_TOAST)
    .first()
    .waitFor({ state: "visible", timeout: LOGIN_TIMEOUT })
    .then(() => "rejected" as const);

  const outcome = await Promise.race([navigated, rejected]);

  if (outcome === "rejected") {
    const message = (await page.locator(ERROR_TOAST).first().innerText())
      .replace(/\s+/g, " ")
      .trim();
    throw new Error(
      `Sign-in failed for E2E_USERNAME on ${baseURL}: ${message}`
    );
  }

  if (new URL(page.url()).pathname.startsWith(CHANGE_PASSWORD_PATH)) {
    throw new Error(
      `E2E_USERNAME is flagged must_change_password, so every other request answers 423 ` +
        `and no screen can load. Clear the flag or use a different account.`
    );
  }

  // The authenticated shell — proof the session survived the navigation and
  // that /auth/me answered, which is what makes the saved storage state usable.
  await expect(page.getByRole("main")).toBeVisible({ timeout: LOGIN_TIMEOUT });
}
