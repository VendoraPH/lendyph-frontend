import { test } from "node:test";
import assert from "node:assert/strict";

import { stepForHit, stepForRunStatus } from "./use-import-reattach";

/**
 * These cover the routing decision only — the part with a history.
 *
 * `cancelled` was added to `ImportPhase` after the first cut of this feature was
 * written, and every place that had spelled "finished" as a hardcoded list of
 * phase names started routing cancelled runs into the live progress view, where
 * they polled a run that would never advance. So the rule under test is not
 * "these phases map to these steps", it is "`is_closed` decides finished, and an
 * unrecognised phase must still land somewhere that self-corrects".
 */

const open = (phase: string) => ({ phase, is_closed: false });
const closed = (phase: string) => ({ phase, is_closed: true });

test("is_closed decides finished, whatever the phase says", () => {
  for (const phase of ["completed", "failed", "cancelled"]) {
    assert.equal(stepForRunStatus(closed(phase)), "result");
  }
});

test("a closed run is finished even when its phase reads as in-progress", () => {
  // Belt and braces: if the server ever closes a run without moving the phase,
  // the flag still wins and the wizard does not sit polling a dead run.
  assert.equal(stepForRunStatus(closed("importing_loans")), "result");
});

test("a phase this build has never heard of is not treated as finished", () => {
  // The exact shape of the next `cancelled`. It must not fall through to step 1
  // (which invites a duplicate import) and must not throw.
  assert.equal(stepForRunStatus(open("quarantining")), "processing");
  assert.equal(stepForRunStatus(closed("quarantining")), "result");
});

test("open phases route to the step that can act on them", () => {
  assert.equal(stepForRunStatus(open("uploading")), "upload");
  assert.equal(stepForRunStatus(open("awaiting_mapping")), "check");
  assert.equal(stepForRunStatus(open("assembled")), "processing");
  assert.equal(stepForRunStatus(open("staging")), "processing");
  assert.equal(stepForRunStatus(open("importing_customers")), "processing");
  assert.equal(stepForRunStatus(open("importing_loans")), "processing");
});

test("a closed run asked for by link opens on its result", () => {
  assert.equal(stepForHit(closed("completed"), "url"), "result");
});

test("a closed run found locally lands on step 1, not on a receipt", () => {
  // The admin came back to start something, not to re-read a job they have
  // already seen. Step 1 shows the prior-import warning instead.
  assert.equal(stepForHit(closed("completed"), "storage"), "prepare");
  assert.equal(stepForHit(closed("cancelled"), "server"), "prepare");
});

test("an OPEN run resumes at its phase's step regardless of source", () => {
  assert.equal(stepForHit(open("uploading"), "storage"), "upload");
  assert.equal(stepForHit(open("awaiting_mapping"), "server"), "check");
  assert.equal(stepForHit(open("importing_loans"), "url"), "processing");
});
