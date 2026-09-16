"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { RouteGuard } from "@/components/common/route-guard";
import { DataState } from "@/components/common/data-state";
import { useApiResource } from "@/hooks";
import { creditScoringService } from "@/services";
import { CreditScoringPageHeader } from "../_components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
      await creditScoringService.updateSettings(draft ?? current);
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
          summary="Module settings — the privacy notice, model version, and confidence/flag definitions — will be editable here once the backend is connected."
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
                    <Label className="text-xs text-muted-foreground">Current version</Label>
                    <Input
                      value={current.score_model_version}
                      onChange={(e) => setDraft({ ...current, score_model_version: e.target.value })}
                      className="max-w-xs"
                    />
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
