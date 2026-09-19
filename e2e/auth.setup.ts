import { test as setup } from "@playwright/test";

import { STORAGE_STATE, SKIP_REASON, hasCredentials } from "./support/env";
import { loginViaUi } from "./support/login";

// File-scope modifier: with no credentials this project is skipped before a
// browser context is ever created, so nothing tries to read (or write) the
// storage state file and the run ends green with a stated reason.
setup.skip(!hasCredentials, SKIP_REASON);

setup("authenticate", async ({ page }) => {
  await loginViaUi(page);
  await page.context().storageState({ path: STORAGE_STATE });
});
