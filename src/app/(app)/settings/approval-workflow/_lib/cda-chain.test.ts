import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CDA_MAX_STEPS,
  cdaChainPayload,
  cdaChainProblem,
  moveDraft,
  sameChain,
  toDrafts,
  type CdaStepDraft,
} from "./cda-chain";

const draft = (name: string, role: string, status = ""): CdaStepDraft => ({ key: name, name, role, status });

test("the saved chain opens as drafts, a missing status as empty text", () => {
  const drafts = toDrafts([
    { id: "cda-step-1", name: "Manager review", role: "manager", kind: "approve", status: null },
    { id: "cda-step-2", name: "Board review", role: "bod1", kind: "approve", status: "Board" },
  ]);
  assert.deepEqual(
    drafts.map((d) => [d.name, d.role, d.status]),
    [
      ["Manager review", "manager", ""],
      ["Board review", "bod1", "Board"],
    ],
  );
  assert.notEqual(drafts[0].key, drafts[1].key);
});

test("the payload sends approve-only steps in order, trimmed, a blank status as null", () => {
  assert.deepEqual(cdaChainPayload([draft("  Manager review ", "manager", "  "), draft("Board review", "bod1", " Board ")]), [
    { name: "Manager review", role: "manager", kind: "approve", status: null },
    { name: "Board review", role: "bod1", kind: "approve", status: "Board" },
  ]);
});

test("the problems read as the server words them", () => {
  assert.equal(cdaChainProblem([draft("A", "manager")]), null);
  assert.equal(
    cdaChainProblem([]),
    "Add at least one review step, or reset the chain to keep a single review.",
  );
  assert.equal(cdaChainProblem([draft(" ", "manager")]), "Give each step a name.");
  assert.equal(cdaChainProblem([draft("A", "")]), "Choose the role for each step.");
  assert.equal(
    cdaChainProblem([draft("Manager  Review", "manager"), draft("manager review", "bod1")]),
    'Two steps are named "manager review". Give each step its own name.',
  );
  const eleven = Array.from({ length: CDA_MAX_STEPS + 1 }, (_, i) => draft(`Step ${i}`, "manager"));
  assert.equal(cdaChainProblem(eleven), "A CDA review chain has at most 10 steps.");
});

test("a step moves up and down, and never past either end", () => {
  const steps = [draft("A", "r"), draft("B", "r"), draft("C", "r")];
  assert.deepEqual(moveDraft(steps, 2, "up").map((s) => s.name), ["A", "C", "B"]);
  assert.deepEqual(moveDraft(steps, 0, "down").map((s) => s.name), ["B", "A", "C"]);
  assert.equal(moveDraft(steps, 0, "up"), steps);
  assert.equal(moveDraft(steps, 2, "down"), steps);
});

test("a chain is unchanged when its payload is the same, order included", () => {
  const saved = [draft("A", "manager"), draft("B", "bod1")];
  assert.equal(sameChain(saved, [{ ...saved[0], name: " A " }, saved[1]]), true);
  assert.equal(sameChain(saved, [saved[1], saved[0]]), false);
  assert.equal(sameChain(saved, [saved[0]]), false);
});
