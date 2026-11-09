import { test } from "node:test";
import assert from "node:assert/strict";
import { ANY_SOURCE } from "./select-items";
import {
  LEDGER_PER_PAGE,
  ledgerHref,
  ledgerQueryString,
  readLedgerQuery,
  type LedgerUrlState,
} from "./dashboard-ledger-query";

const DEFAULTS = { from: "2026-11-01", to: "2026-11-09" };
const params = (qs: string) => new URLSearchParams(qs);

test("reads the account, dates, source and page from the URL", () => {
  assert.deepEqual(
    readLedgerQuery(params("account_id=12&from=2026-10-01&to=2026-10-31&source=expense&page=3"), DEFAULTS),
    {
      accountId: 12,
      from: "2026-10-01",
      to: "2026-10-31",
      source: "expense",
      page: 3,
      perPage: LEDGER_PER_PAGE,
    },
  );
});

test("missing values fall back to no account, the default range, any source and page 1", () => {
  assert.deepEqual(readLedgerQuery(params(""), DEFAULTS), {
    accountId: null,
    from: "2026-11-01",
    to: "2026-11-09",
    source: ANY_SOURCE,
    page: 1,
    perPage: 25,
  });
});

test("bad values are dropped, not sent", () => {
  const state = readLedgerQuery(
    params("account_id=abc&from=2026-13-40&to=yesterday&source=bogus&page=-2&per_page=7"),
    DEFAULTS,
  );
  assert.equal(state.accountId, null);
  assert.equal(state.from, DEFAULTS.from);
  assert.equal(state.to, DEFAULTS.to);
  assert.equal(state.source, ANY_SOURCE);
  assert.equal(state.page, 1);
  assert.equal(state.perPage, 25);
});

test("an account id must be a whole positive number", () => {
  for (const bad of ["0", "-4", "2.5", "1e3", " 7"]) {
    assert.equal(readLedgerQuery(params(`account_id=${encodeURIComponent(bad)}`), DEFAULTS).accountId, null, bad);
  }
  assert.equal(readLedgerQuery(params("page=2.5"), DEFAULTS).page, 1);
  assert.equal(readLedgerQuery(params("per_page=100"), DEFAULTS).perPage, 100);
});

test("writes only what differs from the defaults", () => {
  const base: LedgerUrlState = {
    accountId: null,
    from: DEFAULTS.from,
    to: DEFAULTS.to,
    source: ANY_SOURCE,
    page: 1,
    perPage: 25,
  };
  assert.equal(ledgerQueryString(base, DEFAULTS), "");
  assert.equal(
    ledgerQueryString(
      { accountId: 12, from: "2026-10-01", to: "2026-10-31", source: "expense", page: 2, perPage: 50 },
      DEFAULTS,
    ),
    "account_id=12&from=2026-10-01&to=2026-10-31&source=expense&page=2&per_page=50",
  );
});

test("what is written reads back the same", () => {
  const state: LedgerUrlState = {
    accountId: 3,
    from: "2026-01-01",
    to: "2026-06-30",
    source: "loan_collection",
    page: 4,
    perPage: 100,
  };
  assert.deepEqual(readLedgerQuery(params(ledgerQueryString(state, DEFAULTS)), DEFAULTS), state);
});

test("ledgerHref links an account's ledger over a range", () => {
  assert.equal(ledgerHref({ accountId: 5 }), "/accounting/general-ledger?account_id=5");
  assert.equal(
    ledgerHref({ accountId: 5, from: "2026-10-01", to: "2026-10-31" }),
    "/accounting/general-ledger?account_id=5&from=2026-10-01&to=2026-10-31",
  );
});
