"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource, usePermission } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { notifySuccess } from "@/lib/notify";
import type { CdaRequirement } from "@/types/cda";
import { CdaPage } from "../_components/cda-page";
import { notifyCdaError } from "../_lib/notify-cda";
import { calendarRowKey, isRequirementRow } from "../_lib/review-chain";
import { ReportRow, RequirementRow } from "./_components/calendar-rows";
import { MarkFiledDialog } from "./_components/mark-filed-dialog";
import { RequirementDialog } from "./_components/requirement-dialog";

function Calendar({ year }: { year: number }) {
  const resource = useApiResource(useCallback(() => cdaService.getCalendar(year), [year]));
  const canPrepare = usePermission().can("cda:prepare");
  const [editing, setEditing] = useState<{ requirement: CdaRequirement | null } | null>(null);
  const [filing, setFiling] = useState<CdaRequirement | null>(null);
  const [deleting, setDeleting] = useState<CdaRequirement | null>(null);
  const [busy, setBusy] = useState(false);

  function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    cdaService
      .deleteRequirement(deleting.id)
      .then(() => {
        notifySuccess("Requirement deleted");
        setDeleting(null);
        resource.refetch();
      })
      .catch((err: unknown) => notifyCdaError(err, "Could not delete the requirement"))
      .finally(() => setBusy(false));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Reports and the cooperative&apos;s own compliance requirements, soonest first.
        </p>
        <PermissionButton permission="cda:prepare" size="sm" onClick={() => setEditing({ requirement: null })}>
          <Plus className="mr-1 h-4 w-4" />
          Add requirement
        </PermissionButton>
      </div>

      <DataState
        resource={resource}
        endpoints={[`GET ${API_ENDPOINTS.CDA.CALENDAR(year)}`]}
        summary={`The ${year} filing deadlines`}
        isEmpty={(rows) => rows.length === 0}
        emptyMessage="Nothing is due for this year."
      >
        {(rows) => (
          <Card>
            <CardContent className="overflow-x-auto pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report or requirement</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Moved to</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time left</TableHead>
                    {canPrepare && (
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) =>
                    isRequirementRow(row) ? (
                      <RequirementRow
                        key={calendarRowKey(row)}
                        row={row}
                        canPrepare={canPrepare}
                        onEdit={() => setEditing({ requirement: row })}
                        onMarkFiled={() => setFiling(row)}
                        onDelete={() => setDeleting(row)}
                      />
                    ) : (
                      <ReportRow key={calendarRowKey(row)} row={row} withActions={canPrepare} />
                    ),
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </DataState>

      <RequirementDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        year={year}
        requirement={editing?.requirement ?? null}
        onSaved={resource.refetch}
      />
      <MarkFiledDialog requirement={filing} onOpenChange={(open) => !open && setFiling(null)} onSaved={resource.refetch} />
      <ConfirmDeleteDialog
        open={deleting !== null}
        title="Delete this requirement?"
        description={
          deleting
            ? `“${deleting.title}” will be removed from the ${year} compliance calendar and gets no more reminders. The audit trail keeps a record of it.`
            : null
        }
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

/**
 * Every deadline of the year, in the server's order (soonest first): each
 * report with CDA's extensions, and the custom compliance requirements staff
 * with `cda:prepare` add, edit, mark filed and delete.
 */
export default function Page() {
  return (
    <CdaPage
      title="Compliance Calendar"
      description="Every CDA report due for the year, with CDA's extension or a report's own deadline where one was set, and the cooperative's own requirements."
    >
      {(ctx) => ctx && <Calendar key={ctx.year} year={ctx.year} />}
    </CdaPage>
  );
}
