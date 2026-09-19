import { expect, test, type Locator, type Page } from "@playwright/test";

import { SKIP_REASON, hasCredentials } from "./support/env";

// Whole-file modifier: no credentials means no browser context is created, so
// the missing storage-state file never surfaces as a confusing launch error.
test.skip(!hasCredentials, SKIP_REASON);

const FEES_PATH = "/settings/fees";

// Staging is a small box behind a Next rewrite, and this page fires two API
// calls before it renders anything. Generous, because a flaky red here costs
// more than a slow green.
const LOAD_TIMEOUT = 45_000;

const EMPTY_TABLE_MESSAGE = "No fees defined yet.";
const NO_MATCH_MESSAGE = "No fees match your search.";

/**
 * Navigate to the fees screen and prove it actually loaded.
 *
 * Three things have to be true and each fails differently:
 *
 *  1. `FeesContent` returns a bare spinner while `loading` — which initialises
 *     to `true` — so nothing on this page can be asserted synchronously.
 *  2. `FeesPage` wraps the content in `<RouteGuard permission="fees:view">`,
 *     so an account without it renders `AccessDenied` instead. Both branches
 *     put an <h1> on screen ("Fees" vs "Access Restricted") and the loading
 *     branch has none, which makes "wait for any level-1 heading" the one wait
 *     that settles the page whichever way it went.
 *  3. The fetch uses `Promise.allSettled` and `setLoading(false)` runs
 *     unconditionally, so a failed request becomes a `role="alert"` banner
 *     next to a page that otherwise looks healthy — never a crash. Asserting
 *     only on the heading would pass on a page that loaded no data at all.
 */
async function openFeesPage(page: Page): Promise<Locator> {
  await page.goto(FEES_PATH);

  // The authenticated shell renders exactly one <main>. Scoping every query to
  // it keeps sonner's toast region — mounted in the root layout, outside the
  // shell — out of the role queries below, `role="alert"` in particular.
  const main = page.getByRole("main");
  const heading = main.getByRole("heading", { level: 1 });

  await expect(
    heading,
    `${FEES_PATH} never rendered a heading. The app shell renders null until the ` +
      `session resolves, so this usually means the saved session was rejected.`
  ).toBeVisible({ timeout: LOAD_TIMEOUT });

  await expect(
    heading,
    `RouteGuard rendered AccessDenied instead of the fees screen: E2E_USERNAME does ` +
      `not hold "fees:view". Every fees:* permission is admin-only ` +
      `(src/constants/rbac.ts), so this test needs an admin account.`
  ).toHaveText("Fees");

  // Same render pass as the heading, so there is nothing left to wait for: if a
  // fetch failed, the banner is already in the DOM by the time the h1 is.
  const banner = main.getByRole("alert");
  const bannerText =
    (await banner.count()) > 0
      ? (await banner.first().innerText()).replace(/\s+/g, " ").trim()
      : "";

  expect(
    bannerText,
    "The fees screen rendered its load-failure banner. Promise.allSettled turns a " +
      "failed request into state rather than an exception, so the page still renders " +
      "— just without the data it is supposed to show."
  ).toBe("");

  return main;
}

/** Data rows only: `<thead>` is rowgroup 0, `<tbody>` is rowgroup 1. */
function feeRows(main: Locator): Locator {
  return main.getByRole("table").getByRole("rowgroup").nth(1).getByRole("row");
}

/**
 * How many fees the table is actually showing.
 *
 * An empty table is not zero rows — the component renders one full-width row
 * carrying the empty-state message, which would otherwise count as a fee.
 */
async function countFeeRows(main: Locator): Promise<number> {
  const emptyState = main.getByRole("cell", {
    name: EMPTY_TABLE_MESSAGE,
    exact: true,
  });
  if ((await emptyState.count()) > 0) return 0;
  return feeRows(main).count();
}

/**
 * Read one of the three summary cards.
 *
 * No ARIA role describes a stat card, so this leans on `data-slot`, which is
 * the card component's own API (src/components/ui/card.tsx) rather than a
 * styling hook. It matches on the card TITLE because the table lives in a card
 * too, and "Fixed" appears in every fixed-fee badge — a plain text filter would
 * match both cards.
 */
async function summaryCount(page: Page, title: string): Promise<number> {
  // `has:` is queried starting from the outer element, so the inner locator has
  // to be page-rooted: an inner locator built from `main` would look for a
  // <main> INSIDE each card and match nothing.
  const card = page
    .getByRole("main")
    .locator('[data-slot="card"]')
    .filter({
      has: page.locator('[data-slot="card-title"]', {
        hasText: new RegExp(`^${title}$`),
      }),
    });

  await expect(
    card,
    `Expected exactly one "${title}" summary card on the fees screen`
  ).toHaveCount(1);

  const raw = (await card.locator('[data-slot="card-content"]').innerText()).trim();
  const value = Number(raw);

  expect(
    Number.isInteger(value),
    `The "${title}" card showed ${JSON.stringify(raw)}, which is not a whole number`
  ).toBe(true);

  return value;
}

test.describe("Fees settings", () => {
  test("renders the fees table for an account that holds fees:view", async ({ page }) => {
    const main = await openFeesPage(page);

    const table = main.getByRole("table");
    await expect(table).toBeVisible();

    for (const column of [
      "Name",
      "Type",
      "Value",
      "Applicable Products",
      "Conditions",
      "Actions",
    ]) {
      await expect(
        table.getByRole("columnheader", { name: column, exact: true })
      ).toBeVisible();
    }
  });

  test("summary cards agree with the rows the table renders", async ({ page }) => {
    const main = await openFeesPage(page);

    const total = await summaryCount(page, "Total Fees");
    const fixed = await summaryCount(page, "Fixed");
    const percentage = await summaryCount(page, "Percentage");

    expect(
      fixed + percentage,
      "Every fee is either fixed or percentage, so the two type cards must add up to the total"
    ).toBe(total);

    // The cards count the fetched list and the table renders it; with an empty
    // search box the two are the same array. A mismatch means the screen
    // dropped rows it had the data for.
    expect(
      await countFeeRows(main),
      "The table is showing a different number of fees than the Total Fees card counted"
    ).toBe(total);
  });

  test("search narrows the table and says so when nothing matches", async ({ page }) => {
    const main = await openFeesPage(page);

    const rowCount = await countFeeRows(main);
    test.skip(
      rowCount === 0,
      "The target deployment has no fees defined, so there is nothing to filter."
    );

    const firstFeeName = (
      await feeRows(main).first().getByRole("cell").first().innerText()
    ).trim();

    const search = main.getByPlaceholder("Search fees...");

    await search.fill("zzzz-no-such-fee-zzzz");
    await expect(
      main.getByRole("cell", { name: NO_MATCH_MESSAGE, exact: true })
    ).toBeVisible();

    await search.fill(firstFeeName);
    await expect(
      main.getByRole("cell", { name: firstFeeName, exact: true }).first()
    ).toBeVisible();
    await expect(
      main.getByRole("cell", { name: NO_MATCH_MESSAGE, exact: true })
    ).toHaveCount(0);
  });

  test("action buttons are disabled rather than hidden", async ({ page }) => {
    const main = await openFeesPage(page);

    // PermissionButton never hides a denied action — it renders the button
    // disabled inside a tooltip. So presence proves nothing; the enabled state
    // is the assertion.
    const addFee = main.getByRole("button", { name: "Add Fee" });
    await expect(addFee).toBeVisible();
    await expect(
      addFee,
      'Add Fee is disabled: either the account lacks "fees:create", or the loan-products ' +
        "fetch failed (the button is also disabled on productsError/loadError)."
    ).toBeEnabled();

    const rowCount = await countFeeRows(main);
    test.skip(
      rowCount === 0,
      "The target deployment has no fees defined, so there are no row actions to check."
    );

    const firstRow = feeRows(main).first();

    await expect(
      firstRow.getByRole("button", { name: "Edit" }),
      'Row Edit is disabled: either the account lacks "fees:update", or loan products ' +
        "failed to load, which the page treats as making fee editing unavailable."
    ).toBeEnabled();

    // Icon-only button; its accessible name comes from aria-label="Delete {name}".
    await expect(
      firstRow.getByRole("button", { name: /^Delete / }),
      'Row Delete is disabled, so the account lacks "fees:delete".'
    ).toBeEnabled();
  });
});
