"use client";

import { useCallback, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { notifyInfo, notifySuccess } from "@/lib/notify";
import { roleLabelForKey } from "@/lib/role-display-name";
import type { ApiRole } from "@/services/role.service";
import type { CdaReviewChain } from "@/types/cda";
import { notifyCdaError } from "@/app/(app)/cda/_lib/notify-cda";
import {
  CDA_MAX_STEPS,
  cdaChainPayload,
  cdaChainProblem,
  moveDraft,
  sameChain,
  toDrafts,
  type CdaStepDraft,
} from "../_lib/cda-chain";
import { CdaStepDialog } from "./cda-step-dialog";

interface EditorProps {
  chain: CdaReviewChain;
  roles: ApiRole[];
  onSaved: (chain: CdaReviewChain) => void;
}

function Editor({ chain, roles, onSaved }: EditorProps) {
  const saved = toDrafts(chain.steps);
  const [edited, setEdited] = useState<CdaStepDraft[] | null>(null);
  const steps = edited ?? saved;
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  const [dialog, setDialog] = useState<{ step: CdaStepDraft | null } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const dirty = edited !== null && !sameChain(edited, saved);
  const problem = steps.length === 0 && !dirty ? null : cdaChainProblem(steps);
  const roleName = (key: string) => roleLabelForKey(key, roles);

  function done(next: CdaReviewChain, message: string) {
    setEdited(null);
    onSaved(next);
    notifySuccess(message);
  }

  function save() {
    setBusy("save");
    cdaService
      .saveReviewChain(cdaChainPayload(steps))
      .then((next) => done(next, "CDA review chain saved"))
      .catch((err: unknown) => notifyCdaError(err, "We couldn't save the CDA review chain. Please try again."))
      .finally(() => setBusy(null));
  }

  function reset() {
    setBusy("reset");
    cdaService
      .resetReviewChain()
      .then((next) => {
        setResetOpen(false);
        done(next, "CDA reports are back to a single review");
      })
      .catch((err: unknown) => notifyCdaError(err, "We couldn't reset the CDA review chain. Please try again."))
      .finally(() => setBusy(null));
  }

  function saveStep(step: CdaStepDraft) {
    const exists = steps.some((s) => s.key === step.key);
    setEdited(exists ? steps.map((s) => (s.key === step.key ? step : s)) : [...steps, step]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          A CDA report sent for review goes through these steps in order. Each step is approved by someone holding its
          role and CDA approval, never the person who sent the report and never the same person twice. Only the last
          step approves the report. With no steps, a report has a single review.
        </p>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <PermissionButton
            permission="settings:update"
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setResetOpen(true)}
            disabled={busy !== null || chain.is_default}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset (Single review)
          </PermissionButton>
          {dirty && (
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={busy !== null}
              onClick={() => {
                setEdited(null);
                notifyInfo("Changes reverted");
              }}
            >
              Revert
            </Button>
          )}
          <PermissionButton
            permission="settings:update"
            size="sm"
            className="h-9 bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            onClick={save}
            disabled={busy !== null || !dirty || problem !== null}
          >
            {busy === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </PermissionButton>
        </div>
      </div>

      {problem && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800/40 dark:bg-red-900/10">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p className="text-sm text-red-700 dark:text-red-400">{problem}</p>
        </div>
      )}
      {dirty && !problem && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/10">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            You have unsaved changes. Reports already in review keep the review they started with.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-medium">Review steps</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => setDialog({ step: null })}
              disabled={steps.length >= CDA_MAX_STEPS}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Step
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {steps.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No review steps: each report has a single review. Click <strong>Add Step</strong> to set up a chain.
            </div>
          )}
          <ol className="space-y-2" aria-label="CDA review steps">
            {steps.map((step, i) => (
              <li
                key={step.key}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex shrink-0 flex-col gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    disabled={i === 0}
                    onClick={() => setEdited(moveDraft(steps, i, "up"))}
                    aria-label={`Move ${step.name} up`}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    disabled={i === steps.length - 1}
                    onClick={() => setEdited(moveDraft(steps, i, "down"))}
                    aria-label={`Move ${step.name} down`}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {i + 1}
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-green-500/30 bg-green-500/10 text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 basis-[180px]">
                  <p className="truncate text-sm font-semibold">{step.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    Role: {roleName(step.role)}
                    {step.status.trim() && (
                      <>
                        <span className="mx-1.5 text-muted-foreground/40">·</span>
                        Status: {step.status.trim()}
                      </>
                    )}
                  </p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setDialog({ step })}>
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 border-destructive/30 text-xs text-destructive hover:bg-destructive/5"
                    onClick={() => setEdited(steps.filter((s) => s.key !== step.key))}
                    aria-label={`Remove ${step.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <CdaStepDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        step={dialog?.step ?? null}
        roles={roles}
        onSave={saveStep}
      />

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Reset to a single review?</DialogTitle>
            <DialogDescription>
              The saved review chain is removed, so the next reports sent for review have a single review. Reports already
              in review keep the steps they started with.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={reset} disabled={busy !== null}>
              {busy === "reset" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset (Single review)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Settings → Approval Workflow, "CDA reports": the review chain a CDA report
 * goes through (`type=cda`). Rendered only for `cda:settings` with every
 * branch while CDA is on; the server checks both again on save and reset.
 */
export function CdaReviewChain({ roles }: { roles: ApiRole[] }) {
  const resource = useApiResource(useCallback(() => cdaService.getReviewChain(), []));
  const [latest, setLatest] = useState<CdaReviewChain | null>(null);

  return (
    <DataState
      resource={resource}
      endpoints={[`GET ${API_ENDPOINTS.SETTINGS.APPROVAL_WORKFLOW}?type=cda`]}
      summary="The CDA review chain"
    >
      {(loaded) => {
        const chain = latest ?? loaded;
        return <Editor key={JSON.stringify(chain.steps)} chain={chain} roles={roles} onSaved={setLatest} />;
      }}
    </DataState>
  );
}
