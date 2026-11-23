"use client";

import { DataState } from "@/components/common/data-state";
import { CollapsibleCard } from "@/components/common/collapsible-card";
import { useApiResource } from "@/hooks";
import { amlaApi } from "@/lib/amla/api";
import { amlaVersionLines } from "@/lib/amla/settings-view";
import { AmlaSettingsTable } from "./amla-settings-table";

/** Every settings version, newest first. Versions are never edited: a change adds the next one. */
export function AmlaVersionsTab() {
  const resource = useApiResource(amlaApi.settingsVersions);
  return (
    <DataState
      resource={resource}
      summary="Every version of the AMLA settings, newest first."
      endpoints={["GET /amla/settings/versions"]}
      isEmpty={(versions) => versions.length === 0}
      emptyMessage="No settings versions yet."
    >
      {(versions) => (
        <>
          {versions.map((version, index) => {
            const lines = amlaVersionLines(version);
            return (
              <CollapsibleCard
                key={version.id}
                title={lines.title}
                defaultOpen={index === 0}
              >
                <p className="mb-3 text-sm text-muted-foreground">
                  {lines.origin} {lines.toVerify}
                </p>
                <AmlaSettingsTable settings={version.settings} />
              </CollapsibleCard>
            );
          })}
        </>
      )}
    </DataState>
  );
}
