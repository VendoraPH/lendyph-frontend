/**
 * What the Pledge Entry page posts for a member's entry and for the bulk
 * "Manual Pledge Entry" dialog: the entries, and how the money came in or went
 * out (one method and reference for the whole batch).
 *
 * WHAT THIS PROVES: both requests carry the method and trimmed reference; a
 * reference is required unless cash, before anything is posted; and the bulk
 * dialog's answer says whether it may close.
 * WHAT IT DOES NOT PROVE: the server's rules or its journals (backend tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bulkEntriesRequest, manualEntryRequest } from "./pledge-entry-request";

test("a member's entry sends the method and trimmed reference", () => {
  assert.deepEqual(
    manualEntryRequest({ borrowerId: 7, type: "credit", amount: 500, date: "2026-11-09", method: "gcash", reference: " GC-1 " }),
    {
      ok: true,
      data: {
        borrower_id: 7,
        date: "2026-11-09",
        description: "Manual credit entry",
        type: "credit",
        amount: 500,
        method: "gcash",
        reference_number: "GC-1",
      },
    },
  );
});

test("a cash entry needs no reference", () => {
  const result = manualEntryRequest({ borrowerId: 7, type: "debit", amount: 50.5, date: "2026-11-09", method: "cash", reference: "" });
  assert.ok(result.ok);
  assert.equal(result.data.method, "cash");
  assert.equal("reference_number" in result.data, false);
});

test("any other method without a reference is refused before posting", () => {
  assert.deepEqual(
    manualEntryRequest({ borrowerId: 7, type: "credit", amount: 500, date: "2026-11-09", method: "maya", reference: "  " }),
    { ok: false, message: "Enter the reference number for this Maya share capital entry." },
  );
});

test("the bulk batch sends one method and reference for every row", () => {
  assert.deepEqual(
    bulkEntriesRequest(
      [
        { pledgeId: 1, amount: 100, type: "credit" },
        { pledgeId: 2, amount: 250.25, type: "debit" },
      ],
      "2026-11-09",
      "bank_transfer",
      " BT-9 ",
    ),
    {
      ok: true,
      data: {
        entries: [
          { pledge_id: 1, amount: 100, type: "credit", date: "2026-11-09" },
          { pledge_id: 2, amount: 250.25, type: "debit", date: "2026-11-09" },
        ],
        method: "bank_transfer",
        reference_number: "BT-9",
      },
    },
  );
});

test("a bulk batch by GCash with no reference is refused, so the dialog stays open", () => {
  const result = bulkEntriesRequest([{ pledgeId: 1, amount: 100, type: "credit" }], "2026-11-09", "gcash", "");
  assert.deepEqual(result, { ok: false, message: "Enter the reference number for this GCash share capital entry." });
});

test("a cash batch sends cash and no reference", () => {
  const result = bulkEntriesRequest([{ pledgeId: 1, amount: 100, type: "credit" }], "2026-11-09", "cash", " ");
  assert.ok(result.ok);
  assert.equal(result.data.method, "cash");
  assert.equal("reference_number" in result.data, false);
});

test("the bulk dialog closes only once the batch has posted", () => {
  // Pinned in the page source (no DOM here): Submit All used to close the
  // dialog whatever happened, so a missing field threw the typed rows away.
  const page = readPage();
  assert.ok(!page.includes("handleBulkSubmit(); setBulkDialogOpen(false);"));
  assert.match(page, /if \(await handleBulkSubmit\(\)\) setBulkDialogOpen\(false\)/);
});

function readPage(): string {
  return readFileSync(join(process.cwd(), "src/app/(app)/share-capital/pledges/page.tsx"), "utf8");
}
