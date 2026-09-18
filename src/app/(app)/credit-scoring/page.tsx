"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { RouteGuard } from "@/components/common/route-guard";
import { DataState } from "@/components/common/data-state";
import { useApiResource } from "@/hooks";
import { creditScoringService } from "@/services";
import { CreditScoringPageHeader } from "./_components/page-header";
import { RISK_LEVEL_LABELS } from "@/constants/risk-level";
import { formatDateTime } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CreditScoringDashboardSummary, RiskLevel } from "@/types/credit-scoring";
import type { LucideIcon } from "lucide-react";
import { Users, TrendingUp, ShieldAlert, History } from "lucide-react";

const CHART_HEX: Record<RiskLevel, string> = {
  very_low: "#10b981",
  low: "#22c55e",
  moderate: "#f59e0b",
  elevated: "#f97316",
  high: "#ef4444",
  very_high: "#b91c1c",
};

const SHORTCUTS: { title: string; href: string; icon: LucideIcon }[] = [
  { title: "Borrower Scores", href: "/credit-scoring/borrowers", icon: Users },
  { title: "Credit Assessment", href: "/credit-scoring/assessment", icon: TrendingUp },
  { title: "Risk Monitoring", href: "/credit-scoring/risk-monitoring", icon: ShieldAlert },
  { title: "Score History", href: "/credit-scoring/score-history", icon: History },
];

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function DashboardBody({ data }: { data: CreditScoringDashboardSummary }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Figure label="Scored Borrowers" value={String(data.total_scored_borrowers)} />
        <Figure label="Average Score" value={Number(data.average_score ?? 0).toFixed(1)} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="mb-2 text-sm font-medium">Risk Distribution</p>
          <div className="relative h-64">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.risk_distribution}
                    dataKey="count"
                    nameKey="risk_level"
                    innerRadius={60}
                    outerRadius={90}
                  >
                    {data.risk_distribution.map((entry) => (
                      <Cell key={entry.risk_level} fill={CHART_HEX[entry.risk_level]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, _name, entry) => [
                      value,
                      RISK_LEVEL_LABELS[entry.payload.risk_level as keyof typeof RISK_LEVEL_LABELS],
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <p className="mb-3 text-sm font-medium">Recent Score Changes</p>
          <div className="space-y-2">
            {data.recent_score_changes.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent score changes.</p>
            )}
            {data.recent_score_changes.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-sm">
                <span>Borrower #{entry.borrower_id}</span>
                <span className="text-muted-foreground">
                  {entry.score} · {RISK_LEVEL_LABELS[entry.risk_level]} · {formatDateTime(entry.calculated_at)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CreditScoringDashboardPage() {
  const fetcher = useCallback(() => creditScoringService.getDashboardSummary(), []);
  const resource = useApiResource<CreditScoringDashboardSummary>(fetcher);

  return (
    <RouteGuard permission="credit_scoring:view" pageName="Credit Scoring">
      <div className="space-y-6">
        <CreditScoringPageHeader
          title="Credit Scoring"
          description="Portfolio-wide view of borrower credit scores and risk distribution."
        />

        <DataState
          resource={resource}
          summary="The credit scoring dashboard will summarize scored borrowers, average score, and risk distribution once the backend is connected."
          endpoints={["GET /credit-scoring/dashboard"]}
        >
          {(data) => <DashboardBody data={data} />}
        </DataState>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SHORTCUTS.map((s) => (
            <Button key={s.href} variant="outline" className="h-auto justify-start gap-2 p-4" nativeButton={false} render={<Link href={s.href} />}>
              <s.icon className="h-4 w-4" />
              {s.title}
            </Button>
          ))}
        </div>
      </div>
    </RouteGuard>
  );
}
