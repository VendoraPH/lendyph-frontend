"use client";

import { useCallback, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate } from "@/lib/format";
import type { CdaTemplate, CdaTemplateStatus } from "@/types/cda";
import { ToneBadge } from "../../_components/tone-badge";
import { REPORT_META, type Tone } from "../../_lib/labels";
import { TemplateDialog } from "./template-dialog";

const STATUS: Record<CdaTemplateStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  active: { label: "Active", tone: "success" },
  retired: { label: "Retired", tone: "warning" },
};

/** Versioned report templates: the fields and rules each CDA report is prepared on. */
export function TemplatesPanel() {
  const resource = useApiResource(useCallback(() => cdaService.listTemplates(), []));
  const [editing, setEditing] = useState<CdaTemplate | null | undefined>(undefined);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Report templates</CardTitle>
          <CardDescription>
            When CDA changes a format, add a new version here. No code change or deploy is needed.
          </CardDescription>
        </div>
        <PermissionButton permission="cda:settings" size="sm" onClick={() => setEditing(null)}>
          <Plus className="mr-1 h-4 w-4" />
          New template
        </PermissionButton>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Applies to</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{REPORT_META[t.report_type].title}</TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.version}</TableCell>
                    <TableCell>
                      {formatDate(t.effective_from)}
                      {t.effective_until ? ` – ${formatDate(t.effective_until)}` : " onward"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[...t.cooperative_types, ...t.asset_classes].join(", ") || "All cooperatives"}
                    </TableCell>
                    <TableCell>
                      <ToneBadge {...STATUS[t.status]} />
                    </TableCell>
                    <TableCell>
                      <PermissionButton
                        permission="cda:settings"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${t.name}`}
                        onClick={() => setEditing(t)}
                      >
                        <Pencil className="h-4 w-4" />
                      </PermissionButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DataState>
      </CardContent>
      <TemplateDialog template={editing} onClose={() => setEditing(undefined)} onSaved={resource.refetch} />
    </Card>
  );
}
