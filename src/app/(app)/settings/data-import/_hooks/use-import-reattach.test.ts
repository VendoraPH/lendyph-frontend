import { test } from "node:test";
import assert from "node:assert/strict";

import {
  forgetsRememberedRun,
  keepsRunForUpload,
  seededRunId,
  stepForHit,
  stepForRunStatus,
} from "./use-import-reattach";

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
  // The Processing step shows the product mapping inline while the run waits
  // on it. The Check step returns early for a re-opened run and never shows it.
  assert.equal(stepForRunStatus(open("awaiting_mapping")), "processing");
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
  assert.equal(stepForHit(open("awaiting_mapping"), "server"), "processing");
  assert.equal(stepForHit(open("awaiting_mapping"), "storage"), "processing");
  assert.equal(stepForHit(open("importing_loans"), "url"), "processing");
});

// ---------------------------------------------------------------------------
// A finished run never takes another upload
// ---------------------------------------------------------------------------

/** A run status as the server reads it: a phase, and whether it is closed. */
const run = (phase: string, is_closed: boolean) => ({ phase, is_closed });

test("a finished run never takes another upload; an open or unread one may", () => {
  for (const phase of ["completed", "failed", "cancelled"]) {
    assert.equal(keepsRunForUpload(run(phase, true)), false, phase);
  }
  assert.equal(keepsRunForUpload(run("uploading", false)), true);
  assert.equal(keepsRunForUpload(null), true, "nothing has said the run is finished yet");
});

test("the wizard keeps a finished run's id only to show its result", () => {
  const finished = run("completed", true);

  // Found on this device or on the server: a receipt, not a resume. Step 1,
  // and no run id, so the next Continue opens a new run.
  assert.equal(seededRunId({ runId: 3, status: finished, step: "prepare" }), null);
  // Asked for by name (?session=): its result is shown, and it uploads nothing.
  assert.equal(seededRunId({ runId: 3, status: finished, step: "result" }), 3);
  // Open runs resume as before.
  assert.equal(seededRunId({ runId: 4, status: run("uploading", false), step: "upload" }), 4);
  assert.equal(seededRunId({ runId: 5, status: run("staging", false), step: "processing" }), 5);
});

test("a remembered finished run is forgotten on load, from this device only", () => {
  const finished = run("completed", true);
  assert.equal(forgetsRememberedRun("storage", finished), true);
  assert.equal(forgetsRememberedRun("storage", run("uploading", false)), false);
  // A link someone followed is theirs to look at, and the server probe only
  // ever answers with an open run.
  assert.equal(forgetsRememberedRun("url", finished), false);
  assert.equal(forgetsRememberedRun("server", finished), false);
});

test("the wizard, Upload and a refused cancel all forget a finished run instead of reusing it", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const read = (file: string) =>
    readFileSync(join(process.cwd(), "src/app/(app)/settings/data-import", file), "utf8");

  const hook = read("_hooks/use-import-reattach.ts");
  assert.match(hook, /forgetsRememberedRun\(source, status\)/, "on load: the remembered finished run is cleared");

  const view = read("_components/data-import-view.tsx");
  assert.match(view, /setRunId\(seededRunId\(hit\)\)/, "on load: a finished run's id is not kept for step 1");
  assert.match(view, /onRunFinished=\{forgetRun\}/, "Upload can hand a finished run back to be forgotten");

  const upload = read("_components/step-upload.tsx");
  assert.match(upload, /!keepsRunForUpload\(serverStatus\)/, "on Continue: a run the server says is finished is not uploaded into");
  // A 409 on cancel re-reads the run: a finished one is forgotten, never looped on.
  assert.match(upload, /keepsRunForUpload\(await dataImportService\.status\(runId\)/);
});
