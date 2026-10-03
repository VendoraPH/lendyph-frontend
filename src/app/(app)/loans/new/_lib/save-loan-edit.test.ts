/**
 * An edit of a loan application, pinned at the wire.
 *
 * The edit page used to read the loan's collaterals after saving and detach
 * every one it had not loaded itself, so a slow or failed load, or a
 * collateral missing from the member's list, detached real collaterals.
 * `PUT /loans/{id}` now takes the whole list and reconciles it on the server.
 *
 * WHAT THIS PROVES: an edit is one PUT and nothing else (no attach, no detach,
 * no re-read), with `collaterals` in the body only when the selection changed,
 * and an attached collateral missing from the member's list kept in it.
 * WHAT IT DOES NOT PROVE: the server's reconcile. That is the backend's test.
 */
import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import type { LoanCollateral } from "@/types/collateral";
import { attachedCollateralRows, type SelectedCollateral } from "./edit-collaterals";

interface Seen {
  method: string;
  path: string;
  body: unknown;
}

let server: Server;
const seen: Seen[] = [];
let saveLoanEdit: typeof import("./save-loan-edit").saveLoanEdit;

function link(id: number, snapshot: number): LoanCollateral {
  return {
    id,
    borrower_id: 3,
    collateral_type_id: 1,
    detail_value: `TCT-${id}`,
    amount: snapshot,
    active_loans: [{ id: 7, loan_account_number: "LN-0007" }],
    pivot: { loan_id: 7, snapshot_value: snapshot, attached_at: null },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname.replace(/^\/api/, "");
      seen.push({ method: req.method ?? "", path, body: raw ? JSON.parse(raw) : null });
      res.setHeader("Content-Type", "application/json");
      if (req.method === "PUT" && path === "/loans/7") {
        return res.end(JSON.stringify({ data: { id: 7 } }));
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ message: "not stubbed" }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  // Outside the browser the client calls NEXT_PUBLIC_API_URL directly.
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${port}/api`;
  ({ saveLoanEdit } = await import("./save-loan-edit"));
});

after(() => {
  server?.close();
});

describe("saveLoanEdit", () => {
  // Collateral 9 is attached but missing from the member's list the picker
  // reads; it comes onto the form from the loan's own link rows.
  const attached = attachedCollateralRows([link(1, 50_000), link(9, 120_000)], 7);

  test("an unchanged selection is one PUT without the collaterals key", async () => {
    seen.length = 0;
    const saved = await saveLoanEdit(7, { purpose: "Tuition" }, attached, attached);

    assert.equal(saved.id, 7);
    assert.deepEqual(seen, [{ method: "PUT", path: "/loans/7", body: { purpose: "Tuition" } }]);
  });

  test("a changed selection is one PUT with the full list, the missing-from-list one kept", async () => {
    seen.length = 0;
    const added: SelectedCollateral = {
      ...attachedCollateralRows([link(4, 30_000)], 7)[0],
      snapshot_value: 30_000,
    };
    await saveLoanEdit(7, { purpose: "Tuition" }, [attached[1], added], attached);

    assert.deepEqual(seen, [
      {
        method: "PUT",
        path: "/loans/7",
        body: {
          purpose: "Tuition",
          collaterals: [
            { collateral_id: 9, snapshot_value: 120_000 },
            { collateral_id: 4, snapshot_value: 30_000 },
          ],
        },
      },
    ]);
  });

  test("makes no attach, detach or collateral read, whatever changed", async () => {
    seen.length = 0;
    await saveLoanEdit(7, {}, [], attached);

    assert.equal(seen.length, 1);
    assert.equal(seen.filter((s) => s.path.includes("/collaterals")).length, 0);
    assert.deepEqual(seen[0].body, { collaterals: [] });
  });

  test("a role that can't state collaterals sends no key, even with a selection", async () => {
    seen.length = 0;
    await saveLoanEdit(7, { purpose: "Tuition" }, attached, null);

    assert.deepEqual(seen, [{ method: "PUT", path: "/loans/7", body: { purpose: "Tuition" } }]);
  });
});
