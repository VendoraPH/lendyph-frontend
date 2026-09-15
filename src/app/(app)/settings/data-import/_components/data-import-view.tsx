"use client";

/**
 * The data-import wizard: Prepare → Check → Upload → Processing → Result.
 *
 * This file is the machine and nothing else. Each step owns its own screen; the
 * machine owns which one is showing, the handful of answers that have to travel
 * between them, and — before any of that — the reattach check that decides
 * whether the admin is starting an import or walking back into one.
 *
 * Ownership note for whoever integrates this: the vocabulary below
 * (`ImportStep`, `ImportFiles`, `PrecheckOutcome`) is declared here because the
 * machine is what holds it, and the steps and the reattach hook import it as
 * `import type`. That is erased at compile time, so the apparent cycle between
 * this file and `../_hooks/use-import-reattach` does not exist at runtime.
 */

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, Info, RotateCw } from "lucide-react";

import { StepIndicator } from "@/components/common/step-indicator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { clearImportSession, type ImportSession } from "@/lib/import-session";
import { cn } from "@/lib/utils";
import type { ImportRunStatus } from "@/types/data-import";

import {
  reattachProbeLabel,
  useImportReattach,
  type ImportReattachHit,
  type ReattachProbe,
} from "../_hooks/use-import-reattach";
import { StepPrepare } from "./step-prepare";
import { StepCheck } from "./step-check";
import { StepUpload } from "./step-upload";
import { StepProcessing } from "./step-processing";
import { StepResult } from "./step-result";

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const IMPORT_STEPS = [
  "prepare",
  "check",
  "upload",
  "processing",
  "result",
] as const;

export type ImportStep = (typeof IMPORT_STEPS)[number];

const STEP_LABELS: Record<ImportStep, string> = {
  prepare: "Prepare",
  check: "Check",
  upload: "Upload",
  processing: "Processing",
  result: "Result",
};

/**
 * The picked files, keyed by `ImportFileKind` — never a positional array. The
 * server has no way to tell a members file from a loans file except by the key
 * we send it.
 */
export interface ImportFiles {
  customers: File | null;
  loans: File | null;
}

/**
 * What step 2 settles before a single byte is uploaded, and the machine then
 * carries to step 3.
 *
 * Deliberately `Pick`ed off `ImportSession` rather than re-declared: these are
 * exactly the answers that have to survive a closed tab, so if that record ever
 * grows a fourth one this breaks here rather than silently dropping it.
 */
export type PrecheckOutcome = Pick<
  ImportSession,
  "hasHeaderRow" | "dateFormat" | "productMap"
>;

const NO_FILES: ImportFiles = { customers: null, loans: null };

// ---------------------------------------------------------------------------
// Reattach panel
// ---------------------------------------------------------------------------

const PROBE_ORDER: ReattachProbe[] = ["url", "storage", "server"];

/**
 * Shown INSTEAD of step 1 while the reattach check runs.
 *
 * Deliberately determinate — it names each source as it is asked and fills a
 * real bar. A bare spinner reads as "the page is slow"; this reads as "we are
 * checking", which is the only thing standing between a returning admin and a
 * second import the server will refuse.
 */
function ReattachPanel({
  probe,
  progress,
}: {
  probe: ReattachProbe;
  progress: number;
}) {
  const activeIndex = PROBE_ORDER.indexOf(probe);

  return (
    <Card>
      <CardContent className="space-y-4 py-6">
        <div>
          <h2 className="text-base font-semibold">
            Checking for an import in progress
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            An import can be picked up where it left off, so we look for one
            before offering to start a new one. Only one import can run at a
            time.
          </p>
        </div>

        <Progress value={progress} className="max-w-md">
          <ProgressLabel className="text-xs" aria-live="polite">
            {reattachProbeLabel(probe)}
          </ProgressLabel>
          <ProgressValue className="text-xs" />
        </Progress>

        <ol className="space-y-1.5 text-xs text-muted-foreground">
          {PROBE_ORDER.map((item, index) => {
            const done = activeIndex === -1 || index < activeIndex;
            const current = item === probe;
            return (
              <li key={item} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-4 items-center justify-center",
                    done && "text-emerald-600",
                  )}
                  aria-hidden="true"
                >
                  {current ? (
                    <Spinner className="size-3" />
                  ) : done ? (
                    "✓"
                  ) : (
                    <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                  )}
                </span>
                <span className={cn(current && "text-foreground")}>
                  {reattachProbeLabel(item)}
                </span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

/**
 * Shown when the check could not complete — a timeout, a 5xx, no network.
 *
 * It blocks, and that is the point. "We could not tell" is not the same as
 * "nothing is running", and rendering step 1 here would be the page asserting
 * the second when it only knows the first. The override exists because an admin
 * whose API is down still deserves a way forward, but it is a decision they
 * make, with the consequence spelled out.
 */
function ReattachErrorPanel({
  message,
  onRetry,
  onProceed,
}: {
  message: string;
  onRetry: () => void;
  onProceed: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertTitle>Could not check for an import in progress</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{message}</p>
        <p>
          If an import is already running, starting another one will be refused
          by the server. Try again before continuing.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            <RotateCw className="size-3.5" aria-hidden="true" />
            Check again
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onProceed}>
            Start a new import without checking
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/** Rendered when a step is reached without the state it needs. Never crashes. */
function LostThreadPanel({ onStartOver }: { onStartOver: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertTitle>This import can&apos;t be resumed from here</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          The details this step needs are no longer in the page — most likely a
          reload landed here without them. Nothing has been sent or lost; start
          again from step 1.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={onStartOver}>
          Back to step 1
        </Button>
      </AlertDescription>
    </Alert>
  );
}

// ---------------------------------------------------------------------------
// Machine
// ---------------------------------------------------------------------------

export function DataImportView() {
  const {
    checking,
    probe,
    progress,
    hit,
    notice,
    error,
    retry,
    proceedWithoutReattach,
    dismissNotice,
  } = useImportReattach();

  const [step, setStep] = useState<ImportStep>("prepare");
  const [branchId, setBranchId] = useState<number | null>(null);
  const [files, setFiles] = useState<ImportFiles>(NO_FILES);
  const [precheck, setPrecheck] = useState<PrecheckOutcome | null>(null);
  const [runId, setRunId] = useState<number | null>(null);

  // Seeded once per distinct hit — identity rather than a boolean, so a retry
  // (which yields a new hit object) seeds again, while an ordinary re-render
  // three steps later cannot yank the admin backwards.
  const [seededHit, setSeededHit] = useState<ImportReattachHit | null>(null);

  // Adjusted during render rather than in an effect, and that is the point: an
  // effect commits a frame FIRST, so a resuming admin gets one paint of an
  // empty step 1 before the wizard jumps to the step they were actually on —
  // the precise "nothing happened, I'll start again" impression this whole
  // check exists to prevent. React supports setting state during render of the
  // same component for exactly this case; it re-renders immediately and never
  // paints the intermediate result.
  if (!checking && hit && seededHit !== hit) {
    setSeededHit(hit);
    setRunId(hit.runId);
    setBranchId(hit.status.branch_id ?? null);
    setStep(hit.step);
  }

  /**
   * A finished run we found on the way in. `is_closed` is what makes it
   * finished — never the phase name, which has already gained one member
   * (`cancelled`) mid-build and broke every hardcoded list of it.
   */
  const priorRun: ImportRunStatus | null = useMemo(
    () => (hit && hit.status.is_closed && hit.step === "prepare" ? hit.status : null),
    [hit],
  );

  const startOver = useCallback(() => {
    clearImportSession();
    setRunId(null);
    setPrecheck(null);
    setFiles(NO_FILES);
    setStep("prepare");
  }, []);

  const currentIndex = IMPORT_STEPS.indexOf(step);
  const stepLabels = useMemo(
    () => IMPORT_STEPS.map((key) => STEP_LABELS[key]),
    [],
  );

  if (checking) {
    return <ReattachPanel probe={probe} progress={progress} />;
  }

  if (error) {
    return (
      <ReattachErrorPanel
        message={error}
        onRetry={retry}
        onProceed={proceedWithoutReattach}
      />
    );
  }

  const hasAnyFile = Boolean(files.customers || files.loans);

  function renderStep() {
    switch (step) {
      case "prepare":
        return (
          <StepPrepare
            branchId={branchId}
            onBranchChange={setBranchId}
            files={files}
            onFilesChange={setFiles}
            priorRun={priorRun}
            onViewPriorRun={() => {
              if (!priorRun) return;
              setRunId(priorRun.id);
              setStep("result");
            }}
            onNext={() => setStep("check")}
          />
        );

      // Steps 2 and 3 have two ways in, and the guards have to admit both.
      //
      // Going FORWARD they always arrive with a branch, a file and (for step 3)
      // the pre-check answers, because step 1 and step 2 will not hand over
      // without them.
      //
      // RESUMING they arrive with a `runId` and almost nothing else, and that
      // is not recoverable state we forgot to keep — a `File` handle is not
      // serialisable, so a reload genuinely cannot carry one, and the pre-check
      // answers live in the stored session rather than in this tree. Re-asking
      // for the file is the resuming step's own job: `resumableChunks` exists
      // precisely to compare a re-picked file against what the session says was
      // already sent, and refuses the resume if they differ. Blocking here on
      // state a resume can never have would make every resume unreachable.
      //
      // So: a `runId` is sufficient on its own; without one, the forward
      // requirements apply. A reload that lands here with neither gets a panel
      // rather than a crash on a null the child was promised would not be one.
      case "check":
        if (runId === null && (branchId === null || !hasAnyFile)) {
          return <LostThreadPanel onStartOver={startOver} />;
        }
        return (
          <StepCheck
            branchId={branchId}
            files={files}
            runId={runId}
            onBack={() => setStep("prepare")}
            onConfirm={(outcome: PrecheckOutcome) => {
              setPrecheck(outcome);
              setStep("upload");
            }}
          />
        );

      case "upload":
        if (runId === null && (branchId === null || !hasAnyFile || !precheck)) {
          return <LostThreadPanel onStartOver={startOver} />;
        }
        return (
          <StepUpload
            branchId={branchId}
            files={files}
            precheck={precheck}
            runId={runId}
            onRunCreated={setRunId}
            onBack={() => setStep("check")}
            onUploaded={() => setStep("processing")}
          />
        );

      case "processing":
        if (runId === null) {
          return <LostThreadPanel onStartOver={startOver} />;
        }
        return (
          <StepProcessing
            runId={runId}
            onSettled={() => setStep("result")}
            onCancelled={startOver}
          />
        );

      case "result":
        if (runId === null) {
          return <LostThreadPanel onStartOver={startOver} />;
        }
        return <StepResult runId={runId} onStartOver={startOver} />;
    }
  }

  return (
    <div className="space-y-4">
      {notice ? (
        // A caution, not a failure: nothing broke, an expected thing turned out
        // not to be there. Amber, matching the prior-import notice on step 1.
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10">
          <Info className="text-amber-600" />
          <AlertTitle>Picking up where you left off wasn&apos;t possible</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{notice}</p>
            <Button type="button" size="sm" variant="ghost" onClick={dismissNotice}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="py-6">
          <StepIndicator current={currentIndex + 1} labels={stepLabels} />

          <p className="mb-4 text-[11px] font-bold tracking-widest text-brand-orange uppercase">
            Step {currentIndex + 1} of {IMPORT_STEPS.length} —{" "}
            {STEP_LABELS[step]}
          </p>

          {renderStep()}
        </CardContent>
      </Card>
    </div>
  );
}
