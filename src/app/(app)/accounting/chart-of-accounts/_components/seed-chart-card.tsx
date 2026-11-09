"use client";

import { useState } from "react";
import { Sprout } from "lucide-react";
import { PermissionGate } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { accountingService } from "@/services";
import type { ChartTemplate } from "@/types";
import { chartTemplateLabel } from "../../_lib/display-labels";
import { chartTemplateItems } from "../../_lib/select-items";
import {
  TEMPLATE_SUMMARIES,
  chartTemplateFromValue,
  seedPreviewRows,
  seedTemplateError,
} from "../_lib/seed-template";
import { SeedPreviewList } from "./seed-preview-list";

/**
 * Structural status read, matching `api-error.ts` — `instanceof AxiosError` is
 * unreliable when axios ends up bundled more than once.
 */
function statusOf(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

interface SeedChartCardProps {
  /**
   * True when the list endpoint is merely absent rather than broken. A failed
   * request tells us nothing about whether a chart exists, so offering to
   * create one on the back of it would be a guess.
   */
  notBuiltYet: boolean;
  /** Re-read the chart so the page flips from preview to the real rows. */
  onSeeded: () => void;
}

/**
 * The one-time "build this organisation's chart of accounts" action.
 *
 * Until someone runs this, `useChartOfAccounts` reports `isTemplate` forever:
 * every picker in the module shows positional placeholder ids, and every form
 * that needs a real account id refuses to submit. The module is unusable until
 * this endpoint is called, and there was previously no way to call it from the
 * app at all.
 *
 * The organisation picks its template first (lending company or cooperative).
 * There is no preselected answer: a chart is seeded once, so Create stays
 * disabled until someone has chosen.
 */
export function SeedChartCard({ notBuiltYet, onSeeded }: SeedChartCardProps) {
  const [template, setTemplate] = useState<ChartTemplate | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const rows = template ? seedPreviewRows(template) : [];

  const pick = (value: string | null) => {
    setTemplate(chartTemplateFromValue(value));
    setTemplateError(null);
  };

  const seed = async () => {
    if (template === null) return;
    setSaving(true);
    setTemplateError(null);
    try {
      const created = await accountingService.seedAccounts(template);
      // Defensive: a successful POST whose body is not the array we expect
      // must not throw here, or a chart that WAS created reports as a failure
      // and the next attempt 409s with no explanation.
      const count = Array.isArray(created) ? created.length : rows.length;
      setConfirming(false);
      notifySuccess(
        "Chart of accounts created",
        `${count} accounts are now yours to edit.`,
      );
      onSeeded();
      return;
    } catch (err) {
      const status = statusOf(err);

      // 409 means accounts already exist — someone else seeded it, very likely
      // in another tab or another session while this page sat open. That is
      // the desired end state, not a failure, so re-read rather than alarm.
      if (status === 409) {
        setConfirming(false);
        notifyInfo(
          "Chart of accounts already set up",
          "Someone else created it. Showing the current one.",
        );
        onSeeded();
        return;
      }

      // The endpoint is not deployed on this instance yet. The module treats a
      // 404/501 as "not connected" everywhere else; a red failure here would
      // read as something the operator can fix, and it is not.
      if (status === 404 || status === 501) {
        notifyInfo(
          "Not available on this deployment yet",
          "Creating the chart needs a newer version of the API.",
        );
        return;
      }

      // The server refused the template: show its words beside the choice.
      const refused = seedTemplateError(err);
      if (refused) {
        setTemplateError(refused);
        return;
      }

      notifyError(err, "Could not create the chart of accounts.");
    } finally {
      setSaving(false);
    }
  };

  if (!notBuiltYet) return null;

  const templateName = template ? chartTemplateLabel(template).toLowerCase() : "";

  return (
    <PermissionGate permission="chart_of_accounts:create">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1">
            <p className="font-medium">Your chart of accounts is not set up</p>
            <p className="max-w-xl text-sm text-muted-foreground">
              Create it and the accounting module becomes usable — journals,
              expenses and transfers all need real accounts to post against.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full max-w-md space-y-1.5">
              <Label htmlFor="seed-chart-template">
                Which chart fits this organisation?
              </Label>
              <Select
                value={template}
                onValueChange={pick}
                items={chartTemplateItems}
              >
                <SelectTrigger id="seed-chart-template" className="w-full">
                  <SelectValue placeholder="Choose a chart" />
                </SelectTrigger>
                <SelectContent>
                  {chartTemplateItems.map((item) => {
                    const choice = chartTemplateFromValue(item.value);
                    return (
                      <SelectItem key={item.value} value={item.value}>
                        {choice ? TEMPLATE_SUMMARIES[choice] : item.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <Button
              disabled={template === null}
              onClick={() => setConfirming(true)}
            >
              <Sprout className="mr-2 h-4 w-4" />
              Create chart
            </Button>
          </div>
          {templateError && (
            <p role="alert" className="text-sm text-destructive">
              {templateError}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={confirming && template !== null}
        onOpenChange={(open) => !saving && setConfirming(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create the {templateName} chart of accounts?</DialogTitle>
            <DialogDescription>
              This writes {rows.length} accounts to your organisation, across
              assets, liabilities, equity, income and expenses.
            </DialogDescription>
          </DialogHeader>
          {/*
            Siblings rather than more content inside the description: Base UI
            renders `DialogDescription` as a <p>, so nesting block content in
            it produces invalid HTML.
          */}
          <SeedPreviewList rows={rows} />
          <p className="text-sm text-muted-foreground">
            Do it once. You can rename, add and deactivate accounts afterwards,
            and every journal entry from here on posts into this tree.
          </p>
          {templateError && (
            <p role="alert" className="text-sm text-destructive">
              {templateError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={saving || template === null}
              onClick={seed}
            >
              {saving && <Spinner className="mr-2 h-4 w-4" />}
              {saving ? "Creating…" : `Create ${rows.length} accounts`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PermissionGate>
  );
}
