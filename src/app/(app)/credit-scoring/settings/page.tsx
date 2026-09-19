"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { RouteGuard } from "@/components/common/route-guard";
import { DataState } from "@/components/common/data-state";
import { useApiResource } from "@/hooks";
import { creditScoringService } from "@/services";
import { CreditScoringPageHeader } from "../_components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { CreditScoringSettings } from "@/types/credit-scoring";

export default function CreditScoringSettingsPage() {
  const fetcher = useCallback(() => creditScoringService.getSettings(), []);
  const resource = useApiResource<CreditScoringSettings>(fetcher);
  const [draft, setDraft] = useState<CreditScoringSettings | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave(current: CreditScoringSettings) {
    setSaving(true);
    try {
      // `score_model_version` is backend-owned: stamped on a score at calculation
      // time and immutable per history row, so it is rendered read-only below and
      // deliberately left out of the body. `updateSettings` takes a
      // Partial<CreditScoringSettings>, and the backend 422s a PUT that carries
      // this key (docs/CREDIT_SCORING_BACKEND_HANDOFF.md, endpoint 11) — a
      // read-only input alone would not stop it going on the wire.
      const payload: Partial<CreditScoringSettings> = { ...current };
      delete payload.score_model_version;
      await creditScoringService.updateSettings(payload);
      toast.success("Settings saved.");
      setDraft(null);
      resource.refetch();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast.error(
        status === 404 || status === 501
          ? "Not connected yet — settings cannot be saved until the backend is live."
          : "Unable to save settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <RouteGuard permission="credit_scoring:settings" pageName="Credit Scoring Settings">
      <div className="space-y-6">
        <CreditScoringPageHeader
          title="Settings"
          description="Privacy notice, score model version, and definitions shown to staff."
        />

        <DataState
          resource={resource}
          summary="Module settings — the privacy notice, the current model version, and confidence/flag definitions — will appear here once the backend is connected."
          endpoints={["GET /credit-scoring/settings", "PUT /credit-scoring/settings"]}
        >
          {(settings) => {
            const current = draft ?? settings;
            return (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Privacy Notice</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={current.privacy_notice}
                      onChange={(e) => setDraft({ ...current, privacy_notice: e.target.value })}
                      className="min-h-32"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Shown to borrowers per NPC (Philippine Data Privacy Act) disclosure
                      requirements before their data is used for scoring.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Score Model Version</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">
                      <span className="font-medium">{current.score_model_version}</span>
                      <p className="text-muted-foreground">
                        Read-only. The version is stamped on each score when it is
                        calculated and is immutable per history row, so it is set by
                        the scoring backend rather than edited here.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Confidence Definitions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {current.confidence_definitions.map((def) => (
                      <div key={def.level} className="text-sm">
                        <span className="font-medium">{def.label}</span>
                        <p className="text-muted-foreground">{def.description}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Hard Flag Definitions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {current.hard_flag_definitions.map((def) => (
                      <div key={def.type} className="text-sm">
                        <span className="font-medium">{def.label}</span>
                        <p className="text-muted-foreground">{def.description}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Button onClick={() => handleSave(current)} disabled={saving}>
                  {saving ? "Saving…" : "Save Settings"}
                </Button>
              </div>
            );
          }}
        </DataState>
      </div>
    </RouteGuard>
  );
}
