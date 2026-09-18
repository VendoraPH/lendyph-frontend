"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { RouteGuard } from "@/components/common/route-guard";
import { DataState } from "@/components/common/data-state";
import { useApiResource } from "@/hooks";
import { creditScoringService } from "@/services";
import { CreditScoringPageHeader } from "../_components/page-header";
import { isValidWeightTotal, sumWeights } from "@/lib/credit-scoring/scorecard-weights";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { ScorecardConfig } from "@/types/credit-scoring";

function CategoriesTab({
  config,
  onChange,
}: {
  config: ScorecardConfig;
  onChange: (next: ScorecardConfig) => void;
}) {
  const total = sumWeights(config.categories);
  const valid = isValidWeightTotal(config.categories);

  return (
    <div className="space-y-4">
      {config.categories.map((cat, idx) => (
        <Card key={cat.key}>
          <CardContent className="flex items-center justify-between gap-4 pt-6">
            <div>
              <p className="text-sm font-medium">{cat.label}</p>
              <p className="text-xs text-muted-foreground">{cat.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                className="w-20"
                value={cat.weight_percent}
                onChange={(e) => {
                  const next = { ...config, categories: [...config.categories] };
                  next.categories[idx] = { ...cat, weight_percent: Number(e.target.value) };
                  onChange(next);
                }}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </CardContent>
        </Card>
      ))}
      <p className={valid ? "text-sm text-emerald-600 dark:text-emerald-400" : "text-sm text-destructive"}>
        Total weight: {total}% {valid ? "(valid)" : "(must equal 100%)"}
      </p>
    </div>
  );
}

function FactorRulesTab({ config }: { config: ScorecardConfig }) {
  return (
    <div className="space-y-2">
      {config.factor_rules.map((rule) => (
        <Card key={rule.id}>
          <CardContent className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium">{rule.label}</p>
              <p className="text-xs text-muted-foreground">{rule.category_key} · {rule.points} pts</p>
            </div>
            <Switch checked={rule.is_active} disabled />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PolicyRulesTab({ config }: { config: ScorecardConfig }) {
  return (
    <div className="space-y-2">
      {config.policy_rules.map((rule) => (
        <Card key={rule.id}>
          <CardContent className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium">{rule.label}</p>
              <p className="text-xs text-muted-foreground">{rule.description}</p>
            </div>
            <Switch checked={rule.is_active} disabled />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ScorecardConfigurationPage() {
  const fetcher = useCallback(() => creditScoringService.getScorecardConfig(), []);
  const resource = useApiResource<ScorecardConfig>(fetcher);
  const [draft, setDraft] = useState<ScorecardConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const active = draft ?? resource.data;

  async function handleSave() {
    if (!active || !isValidWeightTotal(active.categories)) return;
    setSaving(true);
    try {
      await creditScoringService.updateScorecardConfig(active);
      toast.success("Scorecard configuration saved.");
      setDraft(null);
      resource.refetch();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast.error(
        status === 404 || status === 501
          ? "Not connected yet — configuration cannot be saved until the backend is live."
          : "Unable to save this configuration.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <RouteGuard permission="credit_scoring:settings" pageName="Scorecard Configuration">
      <div className="space-y-6">
        <CreditScoringPageHeader
          title="Scorecard Configuration"
          description="Category weights, factor rules, and policy rules used to compute scores."
          actions={
            <Button onClick={handleSave} disabled={!active || !isValidWeightTotal(active.categories) || saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          }
        />

        <DataState
          resource={resource}
          summary="Scorecard category weights, factor rules, and policy rules will be editable here once the backend is connected."
          endpoints={["GET /credit-scoring/scorecard-config", "PUT /credit-scoring/scorecard-config"]}
        >
          {(config) => {
            const current = active ?? config;
            return (
              <Tabs defaultValue="categories">
                <TabsList>
                  <TabsTrigger value="categories">Categories</TabsTrigger>
                  <TabsTrigger value="factors">Factor Configuration</TabsTrigger>
                  <TabsTrigger value="policy">Policy Rules</TabsTrigger>
                </TabsList>
                <TabsContent value="categories">
                  <CategoriesTab config={current} onChange={setDraft} />
                </TabsContent>
                <TabsContent value="factors">
                  <FactorRulesTab config={current} />
                </TabsContent>
                <TabsContent value="policy">
                  <PolicyRulesTab config={current} />
                </TabsContent>
              </Tabs>
            );
          }}
        </DataState>
      </div>
    </RouteGuard>
  );
}
