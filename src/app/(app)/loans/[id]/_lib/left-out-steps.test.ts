import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { LoanApprovalLeftOutStep, LoanApprovalStep } from "@/types/loan-approval";
import { approvalChainItems } from "./left-out-steps";

const step = (index: number, kind: LoanApprovalStep["kind"], name: string): LoanApprovalStep => ({
  id: 100 + index,
  index,
  step_id: name.toLowerCase().replace(/\s+/g, "-"),
  name,
  role: "manager",
  kind,
  status: index === 0 ? "approved" : index === 1 ? "pending" : "waiting",
});

const chain = [step(0, "submit", "Processor"), step(1, "approve", "First Review"), step(2, "release", "Release")];

const headOffice: LoanApprovalLeftOutStep = {
  step_id: "head-office",
  name: "Head Office",
  min_principal: "50000.00",
  description: 'Step "Head Office" left out: the principal of ₱10,000.00 is below its minimum of ₱50,000.00.',
};
const board: LoanApprovalLeftOutStep = {
  step_id: "board",
  name: "Board",
  min_principal: "250000.00",
  description: 'Step "Board" left out: the principal of ₱10,000.00 is below its minimum of ₱250,000.00.',
};

const shape = (items: ReturnType<typeof approvalChainItems>) =>
  items.map((item) => (item.type === "step" ? `${item.step.name}#${item.position}` : `skipped:${item.name}`));

describe("approvalChainItems", () => {
  test("with no left-out steps, absent or empty, the chain is the server's steps, numbered as before", () => {
    for (const none of [undefined, null, []]) {
      const items = approvalChainItems(chain, none);
      assert.deepEqual(shape(items), ["Processor#0", "First Review#1", "Release#2"]);
      assert.ok(items.every((item) => item.type === "step"));
    }
  });

  test("a left-out step sits in the chain before the Release step, with the server's words", () => {
    const items = approvalChainItems(chain, [headOffice]);
    assert.deepEqual(shape(items), ["Processor#0", "First Review#1", "skipped:Head Office", "Release#2"]);
    const skipped = items[2];
    assert.equal(skipped.type, "left_out");
    if (skipped.type === "left_out") assert.equal(skipped.description, headOffice.description);
  });

  test("the kept steps keep their numbers, so Step N of M still counts only them", () => {
    const items = approvalChainItems(chain, [headOffice, board]);
    const positions = items.flatMap((item) => (item.type === "step" ? [item.position] : []));
    assert.deepEqual(positions, [0, 1, 2]);
  });

  test("several left-out steps keep the server's order", () => {
    assert.deepEqual(shape(approvalChainItems(chain, [headOffice, board])), [
      "Processor#0",
      "First Review#1",
      "skipped:Head Office",
      "skipped:Board",
      "Release#2",
    ]);
  });

  test("a round with no Release step lists them at its end", () => {
    assert.deepEqual(shape(approvalChainItems(chain.slice(0, 2), [headOffice])), [
      "Processor#0",
      "First Review#1",
      "skipped:Head Office",
    ]);
  });

  test("an entry without a name or the server's words is never shown", () => {
    const junk = [
      { ...headOffice, name: "  " },
      { ...board, description: "" },
      null,
      "Head Office",
    ] as unknown as LoanApprovalLeftOutStep[];
    assert.deepEqual(shape(approvalChainItems(chain, junk)), ["Processor#0", "First Review#1", "Release#2"]);
  });

  test("keys stay unique, even for a repeated step id", () => {
    const items = approvalChainItems(chain, [headOffice, { ...headOffice }]);
    const keys = items.map((item) => item.key);
    assert.equal(new Set(keys).size, keys.length);
  });
});
