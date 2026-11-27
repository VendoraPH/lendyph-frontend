import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchReceiptPage, receiptSearchParams, toReceiptOption } from "./receipt-search";

describe("what is asked of the server", () => {
  test("the first 25 receipts before typing", () => {
    assert.deepEqual(receiptSearchParams(""), { per_page: 25 });
  });

  test("25 at a time when searching", () => {
    assert.deepEqual(receiptSearchParams("OR-0012"), { per_page: 25, search: "OR-0012" });
  });
});

describe("toReceiptOption", () => {
  test("names the receipt, with the member, amount and date to tell it apart", () => {
    assert.deepEqual(
      toReceiptOption({
        id: 5,
        receipt_number: "OR-000005",
        borrower_name: "Ana Reyes",
        amount_paid: 1500,
        payment_date: "2026-09-01",
        status: "posted",
      }),
      { id: 5, label: "OR-000005", hint: "Ana Reyes · ₱1,500.00 · Sep 1, 2026" },
    );
  });

  test("a voided receipt is marked before it is chosen", () => {
    assert.match(toReceiptOption({ id: 5, receipt_number: "OR-5", status: "voided" }).hint, /VOID/);
  });

  test("a row with no receipt number reads by its id", () => {
    assert.equal(toReceiptOption({ id: 5 }).label, "Payment #5");
  });
});

describe("fetchReceiptPage", () => {
  test("one page for one query, with the server's total", async () => {
    let calls = 0;
    const page = await fetchReceiptPage(async (params) => {
      calls += 1;
      assert.deepEqual(params, { per_page: 25, search: "Ana" });
      return { data: [{ id: 1, receipt_number: "OR-1" }], meta: { total: 40 } };
    }, "Ana");
    assert.equal(calls, 1);
    assert.equal(page.query, "Ana");
    assert.equal(page.total, 40);
    assert.equal(page.rows[0].label, "OR-1");
  });
});

test("the picker never drains the payments", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/app/(app)/printables/[printableId]/page.tsx"),
    "utf8",
  );
  assert.doesNotMatch(source, /repaymentService\s*\.\s*listAll/);
  assert.match(source, /useSearchPage/);
});
