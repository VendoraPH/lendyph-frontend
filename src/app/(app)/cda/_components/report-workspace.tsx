"use client";

import { useState, type ReactNode } from "react";
import { Lock, Save } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Card, CardContent } from "@/components/ui/card";
import { usePermission } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { formatDateTime } from "@/lib/format";
import { useCdaReport } from "../_hooks/use-cda-report";
import { countBySeverity } from "../_lib/readiness";
import { collectEdits, missingRequired, type FieldDrafts } from "../_lib/report-values";
import { REPORT_META } from "../_lib/labels";
import { isLocked } from "../_lib/workflow";
import { CdaPageHeader } from "./cda-page-header";
import { ReadinessMeter } from "./readiness-meter";
import { ReportSection } from "./report-section";
import { ReportStatusBadge } from "./tone-badge";
import { ValidationPanel } from "./validation-panel";
import { WorkflowActions } from "./workflow-actions";
import { WorkflowHistory } from "./workflow-history";
import { ExportButtons } from "./export-buttons";
import type { CdaFieldValue, CdaReport, CdaReportType } from "@/types/cda";

interface ReportWorkspaceProps {
  type: CdaReportType;
  /** Module-specific content shown above the template sections (PESOS score, registers, …). */
  children?: ReactNode;
}

function ReportBody({ report, onChange }: { report: CdaReport; onChange: (r: CdaReport) => void }) {
  const { can } = usePermission();
  const [drafts, setDrafts] = useState<{ reportId: number; values: FieldDrafts }>({ reportId: report.id, values: {} });
  const [saving, setSaving] = useState(false);
  // Drafts belong to one report; a year switch starts clean.
  const values = drafts.reportId === report.id ? drafts.values : {};
  const locked = report.locked || isLocked(report.status);
  const editable = !locked && can("cda:prepare");
  const dirty = Object.keys(values).length > 0;
  const critical = countBySeverity(report.issues).critical;

  function edit(key: string, value: CdaFieldValue, remarks?: string | null) {
    setDrafts({ reportId: report.id, values: { ...values, [key]: { value, remarks } } });
  }

  function save() {
    const missing = missingRequired(report.sections, values);
    if (missing.length > 0) {
      notifyValidation(missing);
      return;
    }
    setSaving(true);
    cdaService
      .updateReport(report.year, report.type, collectEdits(report.sections, values))
      .then((next) => {
        notifySuccess("Report saved");
        setDrafts({ reportId: next.id, values: {} });
        onChange(next);
      })
      .catch((err: unknown) => notifyError(err, "Could not save the report"))
      .finally(() => setSaving(false));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <ReportStatusBadge status={report.status} />
              {report.template && (
                <span className="text-xs text-muted-foreground">
                  Template {report.template.name} v{report.template.version}
                </span>
              )}
            </div>
            {report.updated_at && (
              <p className="text-xs text-muted-foreground">Last updated {formatDateTime(report.updated_at)}</p>
            )}
          </div>
          <ReadinessMeter value={report.readiness} critical={critical} className="w-full sm:w-64" />
        </CardContent>
      </Card>

      {locked && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This report is locked
            {report.finalized_at ? ` since ${formatDateTime(report.finalized_at)}` : ""}. Reopen it with a reason to
            make changes.
            {report.snapshot_checksum && (
              <span className="block break-all text-xs">Snapshot checksum: {report.snapshot_checksum}</span>
            )}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <WorkflowActions report={report} onChange={onChange} />
        <div className="flex flex-wrap gap-2">
          {!locked && (
            <PermissionButton permission="cda:prepare" size="sm" onClick={save} disabled={!dirty || saving}>
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Saving…" : "Save changes"}
            </PermissionButton>
          )}
          <ExportButtons report={report} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          {report.sections.map((section) => (
            <ReportSection key={section.key} section={section} drafts={values} editable={editable} onEdit={edit} />
          ))}
        </div>
        <div className="space-y-4">
          <ValidationPanel issues={report.issues} />
          <WorkflowHistory events={report.history} />
        </div>
      </div>
    </div>
  );
}

/**
 * Every CDA report screen: the server sends the template-driven report
 * (auto-pulled figures, manual fields, validation, workflow state) and this
 * renders it. Report-specific screens differ only in `children`.
 */
export function ReportWorkspace({ type, children }: ReportWorkspaceProps) {
  const meta = REPORT_META[type];
  const { year, resource, replace } = useCdaReport(type);

  return (
    <div className="space-y-6">
      <CdaPageHeader title={meta.title} description={meta.description} />
      {children}
      <DataState
        resource={resource}
        endpoints={[`GET ${API_ENDPOINTS.CDA.REPORT(year, type)}`, `PUT ${API_ENDPOINTS.CDA.REPORT(year, type)}`]}
        summary={`The FY ${year} ${meta.title} with its validation and workflow`}
      >
        {(report) => <ReportBody report={report} onChange={replace} />}
      </DataState>
    </div>
  );
}
