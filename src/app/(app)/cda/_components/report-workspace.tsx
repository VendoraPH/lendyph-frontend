"use client";

import { useState } from "react";
import { Lock, RefreshCw, Save } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Card, CardContent } from "@/components/ui/card";
import { usePermission } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { httpStatusOf } from "@/lib/api-error";
import { notifyError, notifyInfo, notifySuccess, notifyValidation } from "@/lib/notify";
import { formatDate, formatDateTime } from "@/lib/format";
import { useCdaReport } from "../_hooks/use-cda-report";
import { STAGE_LABELS, labelOf, reportName } from "../_lib/labels";
import { fieldInputs, missingReasons, type FieldDraft, type FieldDrafts } from "../_lib/report-fields";
import { DeadlineBadge, ReportStatusBadge, ToneBadge } from "./tone-badge";
import { ExportPanel } from "./export-panel";
import { ReadinessBreakdown } from "./readiness-breakdown";
import { ReadinessMeter } from "./readiness-meter";
import { ReportSection } from "./report-section";
import { ValidationPanel } from "./validation-panel";
import { WorkflowActions } from "./workflow-actions";
import { WorkflowHistory } from "./workflow-history";
import type { CdaReport, CdaReportPart, CdaReportType } from "@/types/cda";

function Summary({ report }: { report: CdaReport }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <ReportStatusBadge status={report.display_status} />
            {report.stage && <ToneBadge tone="info" label={labelOf(STAGE_LABELS, report.stage)} />}
            {report.provisional && <ToneBadge tone="warning" label="Provisional figures" />}
            {report.template && (
              <span className="text-xs text-muted-foreground">
                Template {report.template.name}, version {report.template.version}
                {!report.template.verified && " (still to be checked against CDA's form)"}
              </span>
            )}
          </div>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            Due {formatDate(report.effective_deadline)}
            <DeadlineBadge daysRemaining={report.days_remaining} filed={report.status === "submitted" || report.status === "accepted"} />
            {report.due_override_on && report.due_override_reference && <span>({report.due_override_reference})</span>}
          </p>
          {report.updated_at && <p className="text-xs text-muted-foreground">Last updated {formatDateTime(report.updated_at)}</p>}
        </div>
        <ReadinessMeter value={report.readiness} critical={report.critical_count} label={report.readiness_label} className="w-full sm:w-64" />
      </CardContent>
    </Card>
  );
}

function Notices({ report, onRefresh, refreshing }: { report: CdaReport; onRefresh: () => void; refreshing: boolean }) {
  return (
    <>
      {!report.applicable && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          {report.not_applicable_reason ?? "This report doesn't apply to the cooperative for this period."}
        </p>
      )}
      {report.locked && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Locked{report.finalized_at ? ` since ${formatDateTime(report.finalized_at)}` : ""}: these are the figures
            of finalized version {report.snapshot?.version ?? "—"}. Reopen it, with a reason, to change them.
            {report.snapshot_checksum && <span className="block break-all text-xs">Checksum: {report.snapshot_checksum}</span>}
          </p>
        </div>
      )}
      {report.stale && !report.locked && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
          <p>A register this report reads has changed since its figures were last refreshed.</p>
          {report.available_actions.includes("refresh") && (
            <PermissionButton permission="cda:prepare" size="sm" variant="outline" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className="mr-1 h-4 w-4" />
              {refreshing ? "Refreshing…" : "Refresh"}
            </PermissionButton>
          )}
        </div>
      )}
    </>
  );
}

function ReportBody({ report, onChange, onReload }: { report: CdaReport; onChange: (r: CdaReport) => void; onReload: () => void }) {
  const { can } = usePermission();
  const [drafts, setDrafts] = useState<{ reportId: number; values: FieldDrafts }>({ reportId: report.id, values: {} });
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const values = drafts.reportId === report.id ? drafts.values : {};
  const canEdit = report.status === "draft" && report.applicable && !report.locked && can("cda:prepare");
  const dirty = Object.keys(values).length > 0;

  function edit(fieldKey: string, draft: FieldDraft | null) {
    const next = { ...values };
    if (draft === null) delete next[fieldKey];
    else next[fieldKey] = draft;
    setDrafts({ reportId: report.id, values: next });
  }

  function save() {
    const missing = missingReasons(report.sections, values);
    if (missing.length > 0) {
      notifyValidation(missing);
      return;
    }
    const fields = fieldInputs(report.sections, values);
    if (fields.length === 0) {
      notifyInfo("Nothing to save");
      return;
    }
    setSaving(true);
    cdaService
      .saveReport(report.id, fields)
      .then((next) => {
        notifySuccess("Report saved");
        setDrafts({ reportId: next.id, values: {} });
        onChange(next);
      })
      .catch((err: unknown) => {
        notifyError(err, "Could not save the report");
        if (httpStatusOf(err) === 409) onReload();
      })
      .finally(() => setSaving(false));
  }

  function refresh() {
    setRefreshing(true);
    cdaService
      .runWorkflow(report.id, { action: "refresh" })
      .then((next) => {
        notifySuccess("Figures refreshed");
        onChange(next);
      })
      .catch((err: unknown) => notifyError(err, "Could not refresh the figures"))
      .finally(() => setRefreshing(false));
  }

  return (
    <div className="space-y-4">
      <Summary report={report} />
      <Notices report={report} onRefresh={refresh} refreshing={refreshing} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <WorkflowActions report={report} onChange={onChange} onReload={onReload} />
        {canEdit && (
          <PermissionButton permission="cda:prepare" size="sm" onClick={save} disabled={!dirty || saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? "Saving…" : "Save changes"}
          </PermissionButton>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          {report.sections.map((section) => (
            <ReportSection key={section.key} section={section} drafts={values} canEdit={canEdit} onEdit={edit} />
          ))}
        </div>
        <div className="space-y-4">
          <ValidationPanel issues={report.issues} critical={report.critical_count} warnings={report.warning_count} />
          {report.readiness_breakdown && <ReadinessBreakdown breakdown={report.readiness_breakdown} sections={report.sections} />}
          <ExportPanel reportId={report.id} />
          <WorkflowHistory events={report.history} />
        </div>
      </div>
    </div>
  );
}

/**
 * One CDA report as the server lays it out (carried over from #510 by
 * Augustin and moved onto the server's contract): its sections and fields
 * with where each figure came from, the issues, readiness and its breakdown,
 * the workflow steps the server offers, server exports and the history.
 * Found by year and type, then saved and moved by id.
 */
export function ReportWorkspace({
  year,
  type,
  part,
}: {
  year: number;
  type: CdaReportType;
  part?: CdaReportPart;
}) {
  const { resource, replace } = useCdaReport(year, type, part);
  return (
    <DataState
      resource={resource}
      endpoints={[`GET ${API_ENDPOINTS.CDA.REPORT_BY_TYPE(year, type)}`]}
      summary={`The ${year} ${reportName(type, part)}, with its issues and workflow`}
    >
      {(report) => <ReportBody report={report} onChange={replace} onReload={resource.refetch} />}
    </DataState>
  );
}
