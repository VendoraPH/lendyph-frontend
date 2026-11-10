"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator } from "lucide-react";
import { ALL_BRANCHES, BranchFilter, branchIdParam } from "@/components/common/branch-filter";
import { PermissionButton } from "@/components/common/permission-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatDate } from "@/lib/format";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/notify";
import { savingsInterestService } from "@/services";
import type { InterestRunPreview, InterestRunRequest } from "@/types";
import { FormField } from "../../_components/field";
import { OptionSelect, type Option } from "../../_components/option-select";
import { buildRunRequest, createdMessage, type RunForm } from "../_lib/run-rules";
import { RunLines } from "./run-lines";
import { RunTotals } from "./run-totals";

const EMPTY_FORM: RunForm = { productId: "", periodStart: "", branch: ALL_BRANCHES };

function PreviewResult({ preview }: { preview: InterestRunPreview }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {formatDate(preview.period_start)} to {formatDate(preview.period_end)}. Nothing is saved until you create the
        runs.
      </p>
      {preview.totals && <RunTotals figures={preview.totals} />}
      {preview.runs.length === 0 && (
        <p className="rounded-lg border py-8 text-center text-sm text-muted-foreground">
          No branch has savings accounts on this product in the period.
        </p>
      )}
      {preview.runs.map((run, index) => (
        <section key={run.branch?.id ?? `branch-${index}`} className="space-y-3">
          <h3 className="font-medium">{run.branch?.name ?? "No branch"}</h3>
          <RunTotals figures={run} />
          <RunLines lines={run.lines} />
        </section>
      ))}
    </div>
  );
}

/**
 * Preview a period's interest (the server computes it and saves nothing),
 * then save it as one draft run per branch. A different user approves each
 * run before it can be posted.
 */
export function NewRunPanel({ productOptions, onCreated }: { productOptions: readonly Option[]; onCreated: () => void }) {
  const router = useRouter();
  const guard = useSubmitGuard();
  const [form, setForm] = useState<RunForm>(EMPTY_FORM);
  const [request, setRequest] = useState<InterestRunRequest | null>(null);
  const [preview, setPreview] = useState<InterestRunPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const change = (patch: Partial<RunForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setRequest(null);
    setPreview(null);
  };

  const runPreview = () => {
    const check = buildRunRequest(form, branchIdParam(form.branch));
    if (!check.ok) {
      notifyWarning(check.message);
      return;
    }
    setPreviewing(true);
    setPreview(null);
    savingsInterestService
      .preview(check.request)
      .then((result) => {
        setRequest(check.request);
        setPreview(result);
      })
      .catch((err: unknown) => notifyError(err, "Couldn't preview the interest for this period."))
      .then(() => setPreviewing(false));
  };

  const create = () => {
    if (!request) return;
    guard
      .run(() => savingsInterestService.create(request))
      ?.then((runs) => {
        notifySuccess(createdMessage(runs), "Another user must approve each run before it posts.");
        setForm(EMPTY_FORM);
        setRequest(null);
        setPreview(null);
        if (runs.length === 1) router.push(`/savings/interest/${runs[0].id}`);
        else onCreated();
      })
      .catch((err: unknown) => notifyError(err, "Couldn't create the interest runs."));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New interest run</CardTitle>
        <CardDescription>
          Pick a product and the first day of the period. The server works out the period, every account&apos;s
          interest and its tax.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="run-product" label="Product">
            <OptionSelect
              id="run-product"
              value={form.productId}
              onChange={(productId) => change({ productId })}
              options={productOptions}
              placeholder="Pick a regular savings product"
            />
          </FormField>
          <FormField id="run-period-start" label="Period starts" hint="The day after the last posted period.">
            <Input
              id="run-period-start"
              type="date"
              value={form.periodStart}
              onChange={(e) => change({ periodStart: e.target.value })}
            />
          </FormField>
          <BranchFilter value={form.branch} onChange={(branch) => change({ branch })} className="w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={runPreview} disabled={previewing}>
            <Calculator className="h-4 w-4" />
            {previewing ? "Previewing…" : "Preview"}
          </Button>
          {preview && (
            <PermissionButton
              permission="savings:post"
              tooltip="Creating interest runs needs the Savings post interest permission"
              onClick={create}
              disabled={guard.submitting || preview.runs.length === 0}
            >
              {guard.submitting ? "Creating…" : "Create draft runs"}
            </PermissionButton>
          )}
        </div>
        {preview && <PreviewResult preview={preview} />}
      </CardContent>
    </Card>
  );
}
