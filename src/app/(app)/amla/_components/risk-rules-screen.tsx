"use client";

import { useState } from "react";
import { CollapsibleCard } from "@/components/common/collapsible-card";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource, usePermission } from "@/hooks";
import { amlaMonitoringAccess } from "@/lib/amla/monitoring-access";
import { amlaMonitoringApi } from "@/lib/amla/monitoring-api";
import { amlaRiskRulesView } from "@/lib/amla/monitoring-view";
import { once } from "@/lib/amla/once";
import type { AmlaRiskRules, AmlaRiskRulesVersion } from "@/types/amla-monitoring";
import { RiskRulesChangeDialog } from "./risk-rules-change-dialog";

/**
 * The AML risk rules: each factor's points by value, the Medium and High
 * thresholds and the high-risk countries, all in the server's words. Read
 * only; a change goes through a change request a second settings holder
 * approves, and applies at each customer's next assessment.
 */
export function RiskRulesScreen() {
  const { can } = usePermission();
  const canAsk = amlaMonitoringAccess(can).askRuleChange;
  const [fetcher, setFetcher] = useState(() => once(() => amlaMonitoringApi.riskRules()));
  const resource = useApiResource(fetcher);
  const [asking, setAsking] = useState(false);

  return (
    <PageFill>
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Risk Rules</h1>
        <p className="text-sm text-muted-foreground">
          How a customer&apos;s AML risk level is scored. They never use gender, civil status, age, spouse details or address.
        </p>
      </div>
      <DataState resource={resource} summary="The AML risk rules and their versions." endpoints={["GET /amla/risk-rules"]}>
        {(rules) => (
          <ScrollBox className="space-y-4 p-px">
            {rules.pending_request_id !== null && (
              <p className="rounded-md border bg-muted/40 p-3 text-sm">
                A risk rules change (request #{rules.pending_request_id}) is waiting for approval in Settings, AMLA. Only one
                can wait at a time.
              </p>
            )}
            <RulesVersionCard
              rules={rules}
              version={rules.current}
              action={
                canAsk && rules.pending_request_id === null ? (
                  <Button size="sm" onClick={() => setAsking(true)}>
                    Ask for a rule change
                  </Button>
                ) : null
              }
            />
            {rules.versions
              .filter((version) => version.version !== rules.current.version)
              .map((version) => (
                <CollapsibleCard key={version.id} title={amlaRiskRulesView(rules, version).title}>
                  <RulesTables rules={rules} version={version} />
                </CollapsibleCard>
              ))}
            {canAsk && (
              <RiskRulesChangeDialog
                open={asking}
                rules={rules}
                onClose={() => setAsking(false)}
                onAsked={() => {
                  setAsking(false);
                  setFetcher(() => once(() => amlaMonitoringApi.riskRules()));
                }}
              />
            )}
          </ScrollBox>
        )}
      </DataState>
    </PageFill>
  );
}

function RulesVersionCard({ rules, version, action }: { rules: AmlaRiskRules; version: AmlaRiskRulesVersion; action: React.ReactNode }) {
  const view = amlaRiskRulesView(rules, version);
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            Rules in force
            {version.to_verify && <Badge variant="outline">To verify</Badge>}
          </CardTitle>
          <CardDescription>
            {view.title}. {view.origin}
          </CardDescription>
        </div>
        {action}
      </CardHeader>
      <CardContent>
        <RulesTables rules={rules} version={version} />
      </CardContent>
    </Card>
  );
}

function RulesTables({ rules, version }: { rules: AmlaRiskRules; version: AmlaRiskRulesVersion }) {
  const view = amlaRiskRulesView(rules, version);
  return (
    <div className="space-y-3 text-sm">
      <p>
        <span className="text-muted-foreground">Levels: </span>
        {view.thresholds}. <span className="text-muted-foreground">High-risk countries: </span>
        {view.countries}. <span className="text-muted-foreground">{view.toVerify}</span>
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Factor</TableHead>
            <TableHead>Value</TableHead>
            <TableHead className="text-right">Points</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {view.factors.flatMap((factor) =>
            factor.values.map((value, index) => (
              <TableRow key={`${factor.key}-${value.key}`}>
                <TableCell className="whitespace-normal">{index === 0 ? factor.label : ""}</TableCell>
                <TableCell className="whitespace-normal">{value.label}</TableCell>
                <TableCell className="text-right">{value.points}</TableCell>
              </TableRow>
            )),
          )}
        </TableBody>
      </Table>
    </div>
  );
}
