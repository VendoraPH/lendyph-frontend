"use client";

import { useState } from "react";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource, usePermission } from "@/hooks";
import { amlaMonitoringAccess } from "@/lib/amla/monitoring-access";
import { amlaMonitoringApi } from "@/lib/amla/monitoring-api";
import { amlaDetectionRuleRows, amlaRuleVersionLine } from "@/lib/amla/monitoring-view";
import { once } from "@/lib/amla/once";
import { formatDateTime } from "@/lib/format";
import type { AmlaDetectionRulesVersion } from "@/types/amla-monitoring";
import { DetectionRulesChangeDialog } from "./detection-rules-change-dialog";

/**
 * Transaction Monitoring: the detection rules every new transaction is
 * checked against, every minute while monitoring is on. The server offers no
 * events or coverage views yet, so this page shows the rules, their history
 * and the change form. Each read is once.
 */
export function DetectionRulesScreen() {
  const { can } = usePermission();
  const access = amlaMonitoringAccess(can);
  const [fetcher, setFetcher] = useState(() => once(() => amlaMonitoringApi.detectionRules()));
  const resource = useApiResource(fetcher);
  const [asking, setAsking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <PageFill>
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Transaction Monitoring</h1>
        <p className="text-sm text-muted-foreground">
          The rules each new customer transaction is checked against. People make every decision: an alert is a prompt to
          review, never a finding.
        </p>
      </div>
      <ScrollBox className="space-y-4 p-px">
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Volumes by branch and channel, with what was screened and flagged, are in AMLA Reports, Transaction Monitoring.
            Alerts and CTR candidates show the transactions behind each one.
          </CardContent>
        </Card>
        <DataState resource={resource} summary="The detection rules in force." endpoints={["GET /amla/detection-rules"]}>
          {(version) => {
            // The rules carry the waiting change (AMLA-B7); Ask is offered only while none waits.
            const pendingId = version.pending_change_request_id ?? null;
            return (
            <>
              {pendingId !== null && (
                <p className="rounded-md border bg-muted/40 p-3 text-sm">
                  A detection rules change (request #{pendingId}) is waiting for approval in Settings, AMLA. Only one can
                  wait at a time.
                </p>
              )}
              <RulesCard version={version} canAsk={access.askRuleChange && pendingId === null} onAsk={() => setAsking(true)} />
              {access.askRuleChange && (
                <DetectionRulesChangeDialog
                  open={asking}
                  version={version}
                  onClose={() => setAsking(false)}
                  onAsked={() => {
                    setAsking(false);
                    setFetcher(() => once(() => amlaMonitoringApi.detectionRules()));
                  }}
                />
              )}
            </>
            );
          }}
        </DataState>
        {access.ruleHistory &&
          (showHistory ? (
            <RuleHistory />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowHistory(true)}>
              Show earlier versions
            </Button>
          ))}
      </ScrollBox>
    </PageFill>
  );
}

function RulesCard({ version, canAsk, onAsk }: { version: AmlaDetectionRulesVersion; canAsk: boolean; onAsk?: () => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            {amlaRuleVersionLine(version)}
            {version.to_verify && <Badge variant="outline">To verify</Badge>}
          </CardTitle>
          <CardDescription>
            {version.effective_at ? `In force from ${formatDateTime(version.effective_at)}. ` : ""}
            {version.note}
          </CardDescription>
        </div>
        {canAsk && (
          <Button size="sm" onClick={onAsk}>
            Ask for a rule change
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {amlaDetectionRuleRows(version).map((rule) => (
            <li key={rule.code} className="space-y-1 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{rule.rule}</span>
                <Badge variant={rule.active === "On" ? "secondary" : "outline"}>{rule.active}</Badge>
                <span className="text-muted-foreground">{rule.priority} priority</span>
              </div>
              <p className="text-muted-foreground">{rule.description}</p>
              {rule.availability && <p className="text-muted-foreground">{rule.availability}</p>}
              <p>{rule.params.join(" · ")}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** Every detection rules version, newest first: read once, only when asked for. */
function RuleHistory() {
  const [fetcher] = useState(() => once(() => amlaMonitoringApi.detectionRuleVersions()));
  const resource = useApiResource(fetcher);
  return (
    <DataState resource={resource} summary="Every detection rules version." endpoints={["GET /amla/detection-rules/versions"]}>
      {(versions) => (
        <>
          {versions.map((version) => (
            <RulesCard key={version.version} version={version} canAsk={false} />
          ))}
        </>
      )}
    </DataState>
  );
}
