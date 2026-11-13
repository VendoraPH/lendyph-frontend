"use client";

import { useCallback, useState } from "react";
import { RouteGuard } from "@/components/common/route-guard";
import { DataState } from "@/components/common/data-state";
import { useApiResource } from "@/hooks";
import { creditScoringService } from "@/services";
import { notifyError, notifySuccess } from "@/lib/notify";
import { fieldErrorsFor } from "@/lib/credit-scoring/field-errors";
import { scorecardBody, scorecardDraftFrom, type ScorecardDraft } from "@/lib/credit-scoring/scorecard-form";
import { factorRangeErrors, type FactorRangeErrors } from "@/lib/credit-scoring/factor-ranges";
import { CreditScoringPageHeader } from "../_components/page-header";
import { CategoriesEditor } from "./_components/categories-editor";
import { RiskBandsEditor } from "./_components/risk-bands-editor";
import { FactorRangesEditor } from "./_components/factor-ranges-editor";
import { PolicyRulesList } from "./_components/read-only-rules";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ScorecardConfig } from "@/types/credit-scoring";

interface SaveErrors {
  categories: string[];
  bands: string[];
  factors: FactorRangeErrors;
}

const NO_ERRORS: SaveErrors = { categories: [], bands: [], factors: { general: [], byFactor: {} } };

function savedNote(before: string, after: ScorecardConfig): string {
  return after.version === before
    ? `Nothing changed. The scorecard stays v${after.version}.`
    : `Saved as scorecard v${after.version}. New scores use it from the next nightly run; existing scores keep their version.`;
}

function ScorecardConfigurationContent() {
  const fetcher = useCallback(() => creditScoringService.getScorecardConfig(), []);
  const resource = useApiResource<ScorecardConfig>(fetcher);
  const [draft, setDraft] = useState<ScorecardDraft | null>(null);
  const [errors, setErrors] = useState<SaveErrors>(NO_ERRORS);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Held here, above the data a save reloads, so the user stays on the tab
  // they saved from.
  const [tab, setTab] = useState<string>("categories");

  async function handleSave(config: ScorecardConfig, current: ScorecardDraft) {
    setSaving(true);
    setErrors(NO_ERRORS);
    setNote(null);
    try {
      const saved = await creditScoringService.updateScorecardConfig(scorecardBody(config, current));
      notifySuccess(saved.version === config.version ? "Nothing changed." : `Scorecard saved as v${saved.version}.`);
      setNote(savedNote(config.version, saved));
      setDraft(null);
      resource.refetch();
    } catch (err: unknown) {
      setErrors({
        categories: fieldErrorsFor(err, "categories"),
        bands: fieldErrorsFor(err, "risk_bands"),
        factors: factorRangeErrors(err, config.factor_rules),
      });
      notifyError(err, "Unable to save this scorecard.");
    } finally {
      setSaving(false);
    }
  }

  const loaded = resource.data;

  return (
    <div className="space-y-6">
      <CreditScoringPageHeader
        title="Scorecard Configuration"
        description="Category weights, risk bands and factor ranges used to work out scores. Each save makes a new scorecard version."
        actions={
          loaded && (
            <Button onClick={() => handleSave(loaded, draft ?? scorecardDraftFrom(loaded))} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          )
        }
      />

      <DataState
        resource={resource}
        summary="Scorecard category weights, risk bands, factor ranges and policy rules."
        endpoints={["GET /credit-scoring/scorecard-config", "PUT /credit-scoring/scorecard-config"]}
      >
        {(config) => {
          const current = draft ?? scorecardDraftFrom(config);
          return (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>Scorecard v{config.version}</span>
                {!config.validated && <Badge variant="outline">Unvalidated</Badge>}
              </div>

              {note && (
                <p role="status" className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  {note}
                </p>
              )}

              <Tabs value={tab} onValueChange={(next) => setTab(String(next))}>
                <TabsList>
                  <TabsTrigger value="categories">Categories</TabsTrigger>
                  <TabsTrigger value="bands">Risk Bands</TabsTrigger>
                  <TabsTrigger value="factors">Factor Ranges</TabsTrigger>
                  <TabsTrigger value="policy">Policy Rules</TabsTrigger>
                </TabsList>
                <TabsContent value="categories">
                  <CategoriesEditor
                    categories={config.categories}
                    weights={current.weights}
                    errors={errors.categories}
                    onChange={(key, value) =>
                      setDraft({ ...current, weights: { ...current.weights, [key]: value } })
                    }
                  />
                </TabsContent>
                <TabsContent value="bands">
                  <RiskBandsEditor
                    bands={config.risk_bands}
                    minimums={current.bands}
                    errors={errors.bands}
                    onChange={(key, value) => setDraft({ ...current, bands: { ...current.bands, [key]: value } })}
                  />
                </TabsContent>
                <TabsContent value="factors">
                  <FactorRangesEditor
                    rules={config.factor_rules}
                    categories={config.categories}
                    drafts={current.factors}
                    errors={errors.factors}
                    onChange={(id, next) => setDraft({ ...current, factors: { ...current.factors, [id]: next } })}
                  />
                </TabsContent>
                <TabsContent value="policy">
                  <PolicyRulesList rules={config.policy_rules} />
                </TabsContent>
              </Tabs>
            </div>
          );
        }}
      </DataState>
    </div>
  );
}

export default function ScorecardConfigurationPage() {
  return (
    <RouteGuard permission="credit_scoring:settings" pageName="Scorecard Configuration">
      <ScorecardConfigurationContent />
    </RouteGuard>
  );
}
