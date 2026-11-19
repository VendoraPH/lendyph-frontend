"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApiResource, usePermission } from "@/hooks";
import { amlaCaseAccess, amlaCaseActions } from "@/lib/amla/case-access";
import { amlaCaseApi } from "@/lib/amla/case-api";
import { amlaCaseRow } from "@/lib/amla/case-view";
import { amlaMonitoringAccess } from "@/lib/amla/monitoring-access";
import { once } from "@/lib/amla/once";
import { useAuthStore } from "@/store";
import type { AmlaCaseDetail } from "@/types/amla-cases";
import { CaseDialogs, type CaseDialog } from "./case-dialogs";
import { CaseAlertsCard, CaseDecisionCard, CaseEvidenceCard, CaseHistoryCard, CaseNotesCard, CaseReportsCard } from "./case-sections";

/**
 * One compliance case: its alerts, notes, evidence, history, decision and STR.
 * The server logs each view, so the case is read once on open; a step the
 * server answers with the whole case shows that answer instead of reading it
 * again, and only an evidence upload reads it again.
 */
export function CaseDetail({ id }: { id: number }) {
  const [fetcher, setFetcher] = useState(() => once(() => amlaCaseApi.case(id)));
  const resource = useApiResource(fetcher);
  const [latest, setLatest] = useState<AmlaCaseDetail | null>(null);
  const reload = () => {
    setLatest(null);
    setFetcher(() => once(() => amlaCaseApi.case(id)));
  };

  return (
    <PageFill>
      <Link href="/amla/cases" className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:underline">
        Back to Compliance Cases
      </Link>
      <DataState resource={resource} summary="This case, its alerts, notes, evidence and decision." endpoints={["GET /amla/cases/{id}"]}>
        {(record) => <CaseBody record={latest ?? record} onCase={setLatest} onReload={reload} />}
      </DataState>
    </PageFill>
  );
}

function CaseBody({ record, onCase, onReload }: { record: AmlaCaseDetail; onCase: (next: AmlaCaseDetail) => void; onReload: () => void }) {
  const router = useRouter();
  const { can } = usePermission();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [dialog, setDialog] = useState<CaseDialog>(null);
  const row = amlaCaseRow(record);
  const actions = amlaCaseActions(record, userId, can);
  const steps: [CaseDialog, string, boolean][] = [
    ["assign", "Assign to me", actions.assignToMe],
    ["note", "Add note", actions.note],
    ["evidence", "Upload evidence", actions.evidence],
    ["decision", "Record decision", actions.decide],
    ["str", "Prepare STR", actions.prepareStr],
  ];
  const shown = steps.filter(([, , allowed]) => allowed);

  return (
    <ScrollBox className="space-y-4 p-px">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {record.reference}
            <Badge variant={row.tone}>{row.status}</Badge>
          </h1>
          <p className="text-sm">{record.title}</p>
          <p className="text-sm text-muted-foreground">
            {row.subject} · {row.code} · {row.branch} · Investigating: {row.assignee} · Opened {row.opened} by {row.openedBy}
          </p>
        </div>
        {shown.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {shown.map(([key, label]) => (
              <Button key={key} variant={key === "decision" || key === "str" ? "default" : "outline"} size="sm" onClick={() => setDialog(key)}>
                {label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CaseDecisionCard record={record} />
        <CaseAlertsCard record={record} canOpenAlerts={amlaMonitoringAccess(can).alerts} />
        <CaseNotesCard record={record} />
        <CaseEvidenceCard record={record} />
        <CaseReportsCard record={record} canOpen={amlaCaseAccess(can).strFilings} />
        <CaseHistoryCard record={record} />
      </div>

      <CaseDialogs
        dialog={dialog}
        record={record}
        userId={userId}
        allowNoStr={actions.decideNoStr}
        onClose={() => setDialog(null)}
        onCase={(next) => {
          setDialog(null);
          onCase(next);
        }}
        onReload={() => {
          setDialog(null);
          onReload();
        }}
        onStr={(report) => {
          setDialog(null);
          router.push(`/amla/filings/${report.id}`);
        }}
      />
    </ScrollBox>
  );
}
