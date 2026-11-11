"use client";

import { useCallback, useState } from "react";
import { Archive, CheckCircle2, FileSpreadsheet, Pencil, Plus } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { CdaTemplate } from "@/types/cda";
import { ReasonDialog } from "../../_components/reason-dialog";
import { ToneBadge } from "../../_components/tone-badge";
import { ASSET_CLASS_LABELS, REPORT_TYPE_LABELS, TEMPLATE_STATUS_META, labelOf } from "../../_lib/labels";
import { TemplateDialog } from "./template-dialog";

function appliesTo(t: CdaTemplate): string {
  const parts = [...t.cooperative_types, ...t.asset_classes.map((a) => labelOf(ASSET_CLASS_LABELS, a))];
  return parts.join(", ") || "All cooperatives";
}

/**
 * Versioned report templates (carried over from #510 by Augustin). Managing
 * them is for a super admin only: the server checks the role, not a
 * permission, and this panel is shown only to that role.
 */
export function TemplatesPanel() {
  const resource = useApiResource(useCallback(() => cdaService.listTemplates(), []));
  const [editing, setEditing] = useState<CdaTemplate | null | undefined>(undefined);
  const [retiring, setRetiring] = useState<CdaTemplate | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  function act(id: number, request: Promise<unknown>, done: string, failed: string) {
    setBusy(id);
    request
      .then(() => {
        notifySuccess(done);
        resource.refetch();
      })
      .catch((err: unknown) => notifyError(err, failed))
      .finally(() => setBusy(null));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Report templates</CardTitle>
          <CardDescription>When CDA changes a form, add a new version here. No code change is needed.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setEditing(null)}>
          <Plus className="mr-1 h-4 w-4" /> New template
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <DataState
          resource={resource}
          endpoints={[`GET ${API_ENDPOINTS.CDA.TEMPLATES}`]}
          summary="Every CDA report template and its versions"
          isEmpty={(d) => d.length === 0}
          emptyMessage="No templates yet."
        >
          {(templates) => (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report</TableHead>
                  <TableHead>Name and version</TableHead>
                  <TableHead>In effect</TableHead>
                  <TableHead>Applies to</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => {
                  const status = TEMPLATE_STATUS_META[t.status] ?? { label: "Other", tone: "neutral" as const };
                  return (
                    <TableRow key={t.id}>
                      <TableCell>{labelOf(REPORT_TYPE_LABELS, t.report_type)}</TableCell>
                      <TableCell>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Version {t.version}
                          {!t.verified && " · to verify against CDA's form"}
                          {t.excel_template?.file_name && ` · workbook ${t.excel_template.file_name}`}
                        </p>
                      </TableCell>
                      <TableCell>
                        {formatDate(t.effective_from)}
                        {t.effective_until ? ` to ${formatDate(t.effective_until)}` : " onward"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{appliesTo(t)}</TableCell>
                      <TableCell>
                        <ToneBadge tone={status.tone} label={status.label} />
                        {t.reason && <p className="mt-1 text-xs text-muted-foreground">{t.reason}</p>}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {t.status === "draft" && (
                            <>
                              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${t.name}`} onClick={() => setEditing(t)} disabled={busy !== null}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Activate ${t.name}`}
                                disabled={busy !== null}
                                onClick={() => act(t.id, cdaService.activateTemplate(t.id), "Template activated", "Could not activate the template")}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <label className="inline-flex">
                                <span className="sr-only">Attach the Excel workbook for {t.name}</span>
                                <FileSpreadsheet className="m-1.5 h-4 w-4 cursor-pointer" aria-hidden="true" />
                                <Input
                                  type="file"
                                  accept=".xlsx"
                                  className="sr-only"
                                  disabled={busy !== null}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = "";
                                    if (file) act(t.id, cdaService.attachWorkbook(t.id, file), "Workbook attached", "Could not attach the workbook");
                                  }}
                                />
                              </label>
                            </>
                          )}
                          {t.status === "active" && (
                            <Button variant="ghost" size="icon-sm" aria-label={`Retire ${t.name}`} onClick={() => setRetiring(t)} disabled={busy !== null}>
                              <Archive className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DataState>
      </CardContent>
      <TemplateDialog template={editing} onClose={() => setEditing(undefined)} onSaved={resource.refetch} />
      <ReasonDialog
        open={retiring !== null}
        onOpenChange={(open) => !open && setRetiring(null)}
        title={retiring ? `Retire ${retiring.name}?` : "Retire"}
        description="Reports already prepared on it keep it. The reason is recorded."
        confirmLabel="Retire"
        onConfirm={(reason) =>
          retiring
            ? cdaService.retireTemplate(retiring.id, reason).then(
                () => {
                  notifySuccess("Template retired");
                  resource.refetch();
                },
                (err: unknown) => {
                  notifyError(err, "Could not retire the template");
                  throw err;
                },
              )
            : Promise.resolve()
        }
      />
    </Card>
  );
}
