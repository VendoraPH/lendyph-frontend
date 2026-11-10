import { test } from "node:test";
import assert from "node:assert/strict";
import { transferTargets } from "./transfer-targets";
import type { SavingsAccount } from "@/types";

const account = (over: Partial<SavingsAccount>) =>
  ({ id: 1, borrower_id: 5, branch_id: 2, status: "active", ...over }) as SavingsAccount;

test("a transfer goes only to the same member's other open accounts in the same branch", () => {
  const from = account({ id: 1 });
  const ids = transferTargets(from, [
    from,
    account({ id: 2 }),
    account({ id: 3, status: "dormant" }),
    account({ id: 4, status: "frozen" }),
    account({ id: 5, status: "closed" }),
    account({ id: 6, branch_id: 9 }),
    account({ id: 7, borrower_id: 8 }),
  ]).map((a) => a.id);
  assert.deepEqual(ids, [2, 3]);
});
