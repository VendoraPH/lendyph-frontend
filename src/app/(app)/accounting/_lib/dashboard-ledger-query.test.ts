import { test } from "node:test";
import assert from "node:assert/strict";
import { ANY_SOURCE } from "./select-items";
import {
  LEDGER_PER_PAGE,
  ledgerHref,
  ledgerRangeError,
  ledgerToFieldError,
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

test("a To before From is refused before sending, by comparing the date strings", () => {
  assert.equal(ledgerRangeError("2026-11-01", "2026-11-09"), null);
  assert.equal(ledgerRangeError("2026-11-09", "2026-11-09"), null);
  assert.equal(ledgerRangeError("2026-11-10", "2026-11-09"), "To must be on or after From.");
  assert.equal(ledgerRangeError("2026-12-31", "2027-01-01"), null);
});

test("the server's message for To is read from a 422", () => {
  const refused = {
    response: {
      status: 422,
      data: {
        message: "The to field must be a date after or equal to from.",
        errors: { to: ["The to field must be a date after or equal to from."] },
      },
    },
  };
  assert.equal(ledgerToFieldError(refused), "The to field must be a date after or equal to from.");
});

test("no To message for other errors or other fields", () => {
  assert.equal(ledgerToFieldError(null), null);
  assert.equal(ledgerToFieldError(new Error("Network Error")), null);
  assert.equal(ledgerToFieldError({ response: { status: 500, data: { errors: { to: ["x"] } } } }), null);
  assert.equal(
    ledgerToFieldError({ response: { status: 422, data: { errors: { from: ["The from field is required."] } } } }),
    null,
  );
  assert.equal(ledgerToFieldError({ response: { status: 422, data: { errors: { to: [] } } } }), null);
  assert.equal(ledgerToFieldError({ response: { status: 422, data: { errors: { to: [42] } } } }), null);
});
