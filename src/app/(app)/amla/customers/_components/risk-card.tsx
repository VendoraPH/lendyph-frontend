"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AmlaSubjectRef } from "@/lib/amla/cdd-access";
import { amlaFactorRows, amlaRiskSummary } from "@/lib/amla/cdd-view";
import type { AmlaCddView } from "@/types/amla-cdd";
import { RiskAssessDialog } from "./risk-assess-dialog";

/**
 * The latest AML risk assessment: every factor with its value and points, the
 * score and level, any override with its reason, and the rules' version. The
 * server scores it; the browser adds nothing up.
 */
export function RiskCard({ view, subject, onAssessed }: { view: AmlaCddView; subject: AmlaSubjectRef; onAssessed: () => void }) {
  const [assessing, setAssessing] = useState(false);
  const risk = view.risk;
  const summary = risk ? amlaRiskSummary(risk) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            AML risk
            {summary && <Badge variant={risk?.level === "high" ? "destructive" : "secondary"}>{summary.level}</Badge>}
          </CardTitle>
          <CardDescription>
            {summary ? `${summary.score}. ${summary.rules}. ${summary.assessed}.` : "Not assessed yet."}
          </CardDescription>
        </div>
        {view.profile.exists && (
          <Button size="sm" variant="outline" onClick={() => setAssessing(true)}>
            Assess or override
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!view.profile.exists && (
          <p className="text-sm text-muted-foreground">Start the due diligence profile before assessing the risk.</p>
        )}
        {summary?.override && <p className="rounded-md border bg-muted/40 p-3 text-sm">{summary.override}</p>}
        {risk && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Factor</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {amlaFactorRows(risk, { type: subject.type, profile: view.profile }).map((factor) => (
                <TableRow key={factor.key}>
                  <TableCell className="whitespace-normal">{factor.label}</TableCell>
                  <TableCell className={factor.notAvailable ? "whitespace-normal text-muted-foreground" : "whitespace-normal"}>
                    {factor.value}
                  </TableCell>
                  <TableCell className="text-right">{factor.points}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {view.risk_assessments.length > 1 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Earlier assessments</summary>
            <ul className="mt-2 space-y-1">
              {view.risk_assessments.slice(1).map((earlier) => {
                const lines = amlaRiskSummary(earlier);
                return (
                  <li key={earlier.id}>
                    {lines.level}, {lines.score.toLowerCase()}. {lines.assessed}.
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </CardContent>
      {view.profile.exists && (
        <RiskAssessDialog
          open={assessing}
          current={risk}
          subject={subject}
          onClose={() => setAssessing(false)}
          onAssessed={() => {
            setAssessing(false);
            onAssessed();
          }}
        />
      )}
    </Card>
  );
}
