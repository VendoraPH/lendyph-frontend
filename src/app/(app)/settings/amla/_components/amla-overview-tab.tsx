"use client";

import { useState } from "react";
import { DataState } from "@/components/common/data-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks";
import type { AmlaSettingsSections } from "@/lib/amla/access";
import { amlaApi } from "@/lib/amla/api";
import { amlaStatusLines, amlaVersionLines } from "@/lib/amla/settings-view";
import type { AmlaSettingsInForce } from "@/types/amla";
import { AmlaSettingsChangeDialog } from "./amla-settings-change-dialog";
import { AmlaSettingsTable } from "./amla-settings-table";

/** Monitoring status (`amla:view`) and the settings in force (with every branch). */
export function AmlaOverviewTab({ sections }: { sections: AmlaSettingsSections }) {
  return (
    <>
      {sections.status && <AmlaStatusCard />}
      {sections.settings && <AmlaSettingsInForceCard canAsk={sections.changeRequests} />}
    </>
  );
}

function AmlaStatusCard() {
  const resource = useApiResource(amlaApi.status);
  return (
    <DataState resource={resource} summary="Whether AMLA monitoring is on, and the settings and calendar in force." endpoints={["GET /amla/status"]}>
      {(status) => (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
            <CardDescription>
              Monitoring is switched on or off on the server. Turning AMLA on never marks the cooperative as registered
              with the AMLC.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              {amlaStatusLines(status).map((line) => (
                <div key={line.label}>
                  <dt className="text-muted-foreground">{line.label}</dt>
                  <dd className="font-medium">{line.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </DataState>
  );
}

function AmlaSettingsInForceCard({ canAsk }: { canAsk: boolean }) {
  const resource = useApiResource(amlaApi.settings);
  return (
    <DataState resource={resource} summary="The AMLA settings in force." endpoints={["GET /amla/settings"]}>
      {(settings) => <SettingsInForce settings={settings} canAsk={canAsk} onAsked={resource.refetch} />}
    </DataState>
  );
}

function SettingsInForce({ settings, canAsk, onAsked }: { settings: AmlaSettingsInForce; canAsk: boolean; onAsked: () => void }) {
  const [asking, setAsking] = useState(false);
  const lines = amlaVersionLines(settings);
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="text-base">Settings in force</CardTitle>
          <CardDescription>
            {lines.title}. {lines.origin} {lines.toVerify}
          </CardDescription>
        </div>
        {canAsk && settings.pending_request_id === null && (
          <Button size="sm" onClick={() => setAsking(true)}>
            Ask for a change
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {settings.pending_request_id !== null && (
          <p className="rounded-md border bg-muted/40 p-3 text-sm">
            <Badge variant="secondary" className="mr-2">
              Waiting
            </Badge>
            A settings change (request #{settings.pending_request_id}) is waiting for approval. Only one can wait at a time.
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          These are documented starting points, not legal thresholds, until counsel or the compliance officer confirms
          each one.
        </p>
        <AmlaSettingsTable settings={settings.settings} />
      </CardContent>
      {canAsk && (
        <AmlaSettingsChangeDialog
          open={asking}
          settings={settings.settings}
          onClose={() => setAsking(false)}
          onAsked={() => {
            setAsking(false);
            onAsked();
          }}
        />
      )}
    </Card>
  );
}
