import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { ApprovalChainStep } from "@/services/approval-workflow.service";
import {
  minimumLabel,
  minimumRule,
  minimumRuleFor,
  minimumToSend,
  sameMinimum,
  stepMinimumErrors,
  withMinimum,
} from "./step-minimum";

const chain: ApprovalChainStep[] = [
  { id: "processor", name: "Processor", role: "loan_processor", kind: "submit" },
  { id: "first", name: "First Review", role: "manager", kind: "approve" },
  { id: "head-office", name: "Head Office", role: "bod1", kind: "approve", min_principal: "50000.00" },
  { id: "release", name: "Release", role: "cashier", kind: "release" },
];

describe("minimumRule: which steps may carry a minimum principal", () => {
  test("an approval step after the first may", () => {
    assert.deepEqual(minimumRule(chain, 2), { allowed: true, reason: null });
  });

  test("Submit, the first approval step and Release may not, each saying why", () => {
    assert.deepEqual(minimumRule(chain, 0), {
      allowed: false,
      reason: "The Submit step always applies, so it can't have a minimum principal.",
    });
    assert.deepEqual(minimumRule(chain, 1), {
      allowed: false,
      reason: "The first approval step always applies, so every loan keeps at least one approval. It can't have a minimum principal.",
    });
    assert.deepEqual(minimumRule(chain, 3), {
      allowed: false,
      reason: "The Release step always applies, so it can't have a minimum principal.",
    });
  });

  test("the first approval step is the first one in the chain, wherever the chain puts it", () => {
    const moved = [chain[0], chain[2], chain[1], chain[3]];
    assert.equal(minimumRule(moved, 1).allowed, false);
    assert.equal(minimumRule(moved, 2).allowed, true);
  });

  test("a step being added is judged where it will sit, at the end of the chain", () => {
    const added: ApprovalChainStep = { id: "board", name: "Board", role: "bod2", kind: "approve" };
    assert.equal(minimumRule([...chain, added], chain.length).allowed, true);
  });

  test("an approval step added to a chain with none yet is the first", () => {
    const bare = [chain[0], chain[3]];
    const added: ApprovalChainStep = { id: "board", name: "Board", role: "bod2", kind: "approve" };
    assert.equal(minimumRule([...bare, added], 2).allowed, false);
  });
});

describe("minimumRuleFor: the step dialog, as its kind is picked", () => {
  test("an approval step being edited keeps its place in the chain", () => {
    assert.equal(minimumRuleFor(chain, 2, "approve").allowed, true);
    assert.equal(minimumRuleFor(chain, 1, "approve").allowed, false);
  });

  test("turning it into a Submit or Release step takes the minimum away", () => {
    assert.equal(minimumRuleFor(chain, 2, "release").allowed, false);
    assert.equal(minimumRuleFor(chain, 2, "submit").allowed, false);
  });

  test("a new step is judged at the end of the chain, by the kind picked", () => {
    assert.equal(minimumRuleFor(chain, chain.length, "approve").allowed, true);
    assert.equal(minimumRuleFor([chain[0], chain[3]], 2, "approve").allowed, false);
  });

  test("once the first approval step is another kind, the next approval step is first", () => {
    assert.equal(minimumRuleFor(chain, 1, "submit").allowed, false);
    const firstTurned = chain.map((s, i) => (i === 1 ? { ...s, kind: "submit" as const } : s));
    assert.equal(minimumRuleFor(firstTurned, 2, "approve").allowed, false);
  });
});

describe("minimumToSend", () => {
  test("empty means no minimum", () => {
    assert.equal(minimumToSend(""), null);
    assert.equal(minimumToSend("   "), null);
  });

  test("the peso sign, commas and spaces are dropped; the amount is sent as typed", () => {
    assert.equal(minimumToSend("50,000"), "50000");
    assert.equal(minimumToSend(" ₱ 50,000.50 "), "50000.50");
  });

  test("anything else goes to the server as it is, so the server can say what's wrong in its words", () => {
    assert.equal(minimumToSend("abc"), "abc");
    assert.equal(minimumToSend("100.005"), "100.005");
  });
});

describe("minimumLabel", () => {
  test("the server's stored minimum in pesos, two decimals", () => {
    assert.equal(minimumLabel("50000.00"), "Minimum principal ₱50,000.00");
  });

  test("no minimum reads nothing", () => {
    assert.equal(minimumLabel(null), null);
    assert.equal(minimumLabel(undefined), null);
    assert.equal(minimumLabel(""), null);
  });

  test("an unsaved entry that isn't an amount reads as typed, never as ₱0.00 or rounded", () => {
    assert.equal(minimumLabel("abc"), 'Minimum principal "abc"');
    assert.equal(minimumLabel("100.005"), 'Minimum principal "100.005"');
    assert.equal(minimumLabel("50000"), "Minimum principal ₱50,000.00");
  });
});

describe("withMinimum", () => {
  test("sets the minimum on the step", () => {
    assert.equal(withMinimum(chain[1], "75000").min_principal, "75000");
  });

  test("no minimum leaves no key, so a chain saved before minimums compares equal", () => {
    const cleared = withMinimum(chain[2], null);
    assert.equal("min_principal" in cleared, false);
    assert.equal(cleared.name, "Head Office");
  });
});

describe("sameMinimum", () => {
  test("no minimum is the same however it is spelled", () => {
    assert.equal(sameMinimum(null, undefined), true);
    assert.equal(sameMinimum("", null), true);
  });

  test("a minimum is compared as stored", () => {
    assert.equal(sameMinimum("50000.00", "50000.00"), true);
    assert.equal(sameMinimum("50000.00", "60000"), false);
    assert.equal(sameMinimum("50000.00", null), false);
  });
});

describe("stepMinimumErrors", () => {
  const refusal = (errors: Record<string, string[]>, status = 422) => ({ response: { status, data: { errors } } });

  test("the server's words land on the step they name, by its place in the chain sent", () => {
    const err = refusal({
      "steps.1.min_principal": [
        "Step \"First Review\" can't have a minimum principal: the first approval step always applies, so every loan keeps at least one approval.",
      ],
    });
    assert.deepEqual(stepMinimumErrors(err, chain), {
      first:
        "Step \"First Review\" can't have a minimum principal: the first approval step always applies, so every loan keeps at least one approval.",
    });
  });

  test("other fields, other statuses and places outside the chain give nothing", () => {
    assert.deepEqual(stepMinimumErrors(refusal({ "steps.1.name": ["The name is required."] }), chain), {});
    assert.deepEqual(stepMinimumErrors(refusal({ "steps.9.min_principal": ["Too low."] }), chain), {});
    assert.deepEqual(stepMinimumErrors(refusal({ "steps.2.min_principal": ["Too low."] }, 500), chain), {});
    assert.deepEqual(stepMinimumErrors(new Error("offline"), chain), {});
  });
});
