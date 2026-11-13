import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ANYONE_WITH_THE_ROLE,
  assignedToText,
  canUserActOnStep,
  forwardFieldError,
  forwardOptions,
  forwardPickFor,
  forwardPickName,
  notYourStepMessage,
  withForwardTo,
} from "./approval-forward";
import { getErrorMessage } from "@/lib/api-error";
import type { ForwardCandidates, LoanApprovalStep } from "@/types/loan-approval";

function step(overrides: Partial<LoanApprovalStep> = {}): LoanApprovalStep {
  return {
    id: 41,
    index: 2,
    step_id: "manager",
    name: "Manager",
    role: "manager",
    kind: "approve",
    status: "pending",
    ...overrides,
  };
}

const CANDIDATES: ForwardCandidates = {
  next_step: { name: "Board Member 1", role: "bod1", role_label: "Board Member 1", kind: "approve" },
  users: [
    { id: 7, name: "Ana Cruz" },
    { id: 9, name: "Ben Reyes" },
  ],
};

describe("the forward payload", () => {
  test("without a pick it sends no forward_to_user_id", () => {
    assert.deepEqual(withForwardTo({ remarks: "ok" }, ANYONE_WITH_THE_ROLE), { remarks: "ok" });
    assert.equal("forward_to_user_id" in withForwardTo({}, ANYONE_WITH_THE_ROLE), false);
  });

  test("with a pick it sends the user's id as a number", () => {
    assert.deepEqual(withForwardTo({ remarks: "ok" }, "9"), { remarks: "ok", forward_to_user_id: 9 });
    assert.deepEqual(withForwardTo({}, "7"), { forward_to_user_id: 7 });
  });

  test("anything that isn't a whole id above 0 is no pick", () => {
    for (const value of ["0", "-3", "1.5", "abc", " "]) {
      assert.deepEqual(withForwardTo({}, value), {}, value);
    }
  });
});

describe("the Forward to options", () => {
  test("a role with no saved name reads by the screen's own name, never the server's 'Bod1'", () => {
    const options = forwardOptions({
      next_step: { name: "BOD1", role: "bod1", role_label: "Bod1", kind: "approve" },
      users: [],
    });
    assert.equal(options[0].label, "Anyone with the BOD1 role");
  });

  test("the default reads 'Anyone with the <role> role', then the candidates by name only", () => {
    assert.deepEqual(forwardOptions(CANDIDATES), [
      { value: ANYONE_WITH_THE_ROLE, label: "Anyone with the Board Member 1 role" },
      { value: "7", label: "Ana Cruz" },
      { value: "9", label: "Ben Reyes" },
    ]);
  });

  test("extra fields on a candidate never reach a label", () => {
    const options = forwardOptions({
      ...CANDIDATES,
      users: [{ id: 7, name: "Ana Cruz", email: "ana@example.test", username: "ana" } as never],
    });
    assert.deepEqual(options.map((o) => o.label), ["Anyone with the Board Member 1 role", "Ana Cruz"]);
  });

  test("no next step (the last one) offers no picker", () => {
    assert.deepEqual(forwardOptions({ next_step: null, users: [] }), []);
    assert.deepEqual(forwardOptions(null), []);
  });

  test("a next step with nobody to pick still offers the role default", () => {
    assert.deepEqual(forwardOptions({ ...CANDIDATES, users: [] }), [
      { value: ANYONE_WITH_THE_ROLE, label: "Anyone with the Board Member 1 role" },
    ]);
  });

  test("a pick belongs to the step it was made on; another step starts at the default", () => {
    assert.equal(forwardPickFor({ key: "41", userId: "7" }, "41"), "7");
    assert.equal(forwardPickFor({ key: "41", userId: "7" }, "42"), ANYONE_WITH_THE_ROLE);
  });

  test("the picked name is read only for a real pick on the same step", () => {
    assert.equal(forwardPickName({ key: "41", userId: "7", name: "Ana Cruz" }, "41"), "Ana Cruz");
    assert.equal(forwardPickName({ key: "41", userId: "7", name: "Ana Cruz" }, "42"), null);
    assert.equal(forwardPickName({ key: "41", userId: ANYONE_WITH_THE_ROLE, name: "Anyone with the Manager role" }, "41"), null);
  });
});

describe("the advisory can-act check", () => {
  const assigned = step({ assigned_to: { id: 7, name: "Ana Cruz" } });

  test("the assignee may act", () => {
    assert.equal(canUserActOnStep(assigned, { id: 7, roles: ["manager"] }), true);
  });

  test("another holder of the role may not act on a step forwarded to someone else", () => {
    assert.equal(canUserActOnStep(assigned, { id: 8, roles: ["manager"] }), false);
  });

  test("another holder of the role may act once the server says the step is theirs again", () => {
    assert.equal(canUserActOnStep({ ...assigned, can_act: true }, { id: 8, roles: ["manager"] }), true);
  });

  test("the server's no still wins for the assignee", () => {
    assert.equal(canUserActOnStep({ ...assigned, can_act: false }, { id: 7, roles: ["manager"] }), false);
  });

  test("admin and super_admin may act on any step, forwarded or not", () => {
    assert.equal(canUserActOnStep(assigned, { id: 1, roles: ["admin"] }), true);
    assert.equal(canUserActOnStep(assigned, { id: 2, roles: ["super_admin"] }), true);
  });

  test("an unassigned step keeps the role rule", () => {
    assert.equal(canUserActOnStep(step(), { id: 8, roles: ["manager"] }), true);
    assert.equal(canUserActOnStep(step(), { id: 8, roles: ["bod1"] }), false);
    assert.equal(canUserActOnStep(step(), { id: 8, roles: [] }), false);
    assert.equal(canUserActOnStep(step(), null), false);
  });
});

describe("the assignee in words", () => {
  test("a forwarded step reads 'Assigned to <name>'", () => {
    assert.equal(assignedToText(step({ assigned_to: { id: 7, name: "Ana Cruz" } })), "Assigned to Ana Cruz");
  });

  test("an unassigned step reads nothing", () => {
    assert.equal(assignedToText(step()), null);
    assert.equal(assignedToText(step({ assigned_to: null })), null);
  });

  test("the refusal names the assignee, or else the role", () => {
    assert.equal(
      notYourStepMessage(step({ assigned_to: { id: 7, name: "Ana Cruz" } }), "Manager", "approve this step"),
      "This step was forwarded to Ana Cruz. Only they or an administrator can approve this step.",
    );
    assert.equal(
      notYourStepMessage(step(), "Manager", "approve this step"),
      "Only a user with the Manager role can approve this step",
    );
  });
});

describe("the server's 422 on forward_to_user_id", () => {
  test("reads the field's own message", () => {
    const err = {
      response: {
        status: 422,
        data: {
          message: "The given data was invalid.",
          errors: { forward_to_user_id: ["Ana Cruz can't see this loan's branch."] },
        },
      },
    };
    assert.equal(forwardFieldError(err), "Ana Cruz can't see this loan's branch.");
  });

  test("the server's one fixed refusal is shown exactly as sent, beside the picker and in the toast", () => {
    const fixed = "The selected user can't be given this approval step.";
    const err = {
      response: {
        status: 422,
        data: { message: fixed, errors: { forward_to_user_id: [fixed] } },
      },
    };
    assert.equal(forwardFieldError(err), fixed);
    assert.equal(getErrorMessage(err, "We couldn't record this approval. Please try again."), fixed);
  });

  test("anything else is not a forward error", () => {
    assert.equal(forwardFieldError({ response: { status: 422, data: { errors: { remarks: ["Too long."] } } } }), null);
    assert.equal(forwardFieldError({ response: { status: 500, data: {} } }), null);
    assert.equal(forwardFieldError(new Error("boom")), null);
    assert.equal(forwardFieldError(null), null);
  });
});
