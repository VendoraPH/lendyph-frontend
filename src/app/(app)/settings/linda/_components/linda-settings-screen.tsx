"use client";

import { useCallback, useState } from "react";
import { DataState } from "@/components/common/data-state";
import { FillSection, PageFill, ScrollBox } from "@/components/common/page-fill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useApiResource } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { notifyError, notifySuccess } from "@/lib/notify";
import { lindaService } from "@/services/linda.service";
import type { LindaSettings } from "@/types/linda";
import {
  lindaAiStatusText,
  lindaLastChangedText,
  lindaModelListed,
  lindaMonthText,
  lindaSaveAllowed,
} from "../_lib/linda-settings";
import { LindaModelChoice } from "./linda-model-option";

/**
 * Settings → Linda: which AI model answers the questions Linda's matcher
 * can't. The key, the monthly cap and the on/off switch stay on the server;
 * every figure here is the server's.
 */
export function LindaSettingsScreen() {
  const fetcher = useCallback(() => lindaService.getSettings(), []);
  const resource = useApiResource(fetcher);
  return (
    <PageFill>
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Linda</h1>
        <p className="text-sm text-muted-foreground">
          Choose the AI model Linda uses for questions it can&apos;t answer by itself. The AI service&apos;s key, the
          monthly spending cap and the on or off switch are set on the server.
        </p>
      </div>
      <DataState
        resource={resource}
        summary="Linda's AI model, its prices and this month's use."
        endpoints={["GET /linda/settings", "PUT /linda/settings"]}
      >
        {(settings) => (
          <LindaSettingsForm
            key={`${settings.model}|${settings.updated_at ?? "new"}`}
            settings={settings}
            onSaved={resource.refetch}
          />
        )}
      </DataState>
    </PageFill>
  );
}

function LindaSettingsForm({ settings, onSaved }: { settings: LindaSettings; onSaved: () => void }) {
  const [selected, setSelected] = useState(settings.model);
  const { submitting, run } = useSubmitGuard();
  const canSave = lindaSaveAllowed(settings, selected, submitting);

  function save() {
    if (!canSave) return;
    run(() => lindaService.updateSettings({ model: selected }))
      ?.then((saved) => {
        const label = saved.models.find((m) => m.id === saved.model)?.label;
        notifySuccess("Linda's model saved", label ? `Linda now uses ${label}.` : undefined);
        onSaved();
      })
      .catch((err: unknown) => notifyError(err, "The Linda settings couldn't be saved."));
  }

  return (
    <FillSection className="gap-4">
      <ScrollBox className="space-y-6 p-px">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI status</CardTitle>
            <CardDescription>{lindaAiStatusText(settings.ai)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{lindaMonthText(settings.month)}</p>
            <p className="text-muted-foreground">
              Questions Linda answers by itself cost nothing. At the cap, questions that need the AI model wait until next
              month; the suggested questions still work.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle id="linda-model-label" className="text-base">
              Model
            </CardTitle>
            <CardDescription>{lindaLastChangedText(settings)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!lindaModelListed(settings) && (
              <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                The model in use isn&apos;t one of the choices below. Pick one and save to change it.
              </p>
            )}
            <div role="radiogroup" aria-labelledby="linda-model-label" className="grid gap-3 lg:grid-cols-3">
              {settings.models.map((model) => (
                <LindaModelChoice
                  key={model.id}
                  model={model}
                  inUse={model.id === settings.model}
                  checked={selected === model.id}
                  disabled={submitting}
                  onSelect={setSelected}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </ScrollBox>

      <div data-fab-clear className="flex shrink-0 justify-end gap-2 border-t pt-4">
        <Button onClick={save} disabled={!canSave}>
          {submitting && <Spinner className="mr-2 h-4 w-4" />}
          Save
        </Button>
      </div>
    </FillSection>
  );
}
