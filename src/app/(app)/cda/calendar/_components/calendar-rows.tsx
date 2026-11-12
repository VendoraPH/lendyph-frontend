import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { CdaCalendarReportRow, CdaRequirement } from "@/types/cda";
import { DeadlineBadge, ReportStatusBadge, ToneBadge } from "../../_components/tone-badge";
import { REPORT_PAGES, reportName } from "../../_lib/labels";
import { requirementStatusMeta } from "../../_lib/review-chain";

/** A CDA report's deadline row. */
export function ReportRow({ row, withActions }: { row: CdaCalendarReportRow; withActions: boolean }) {
  const name = reportName(row.report_type, row.part);
  return (
    <TableRow>
      <TableCell>
        {row.restricted ? (
          <span className="font-medium">{name}</span>
        ) : (
          <Link href={REPORT_PAGES[row.report_type]?.href ?? "/cda"} className="font-medium hover:underline">
            {name}
          </Link>
        )}
      </TableCell>
      <TableCell>{formatDate(row.default_due_on)}</TableCell>
      <TableCell>
        {row.effective_deadline !== row.default_due_on ? (
          <>
            {formatDate(row.effective_deadline)}
            {row.due_override_reference && <span className="block text-xs text-muted-foreground">{row.due_override_reference}</span>}
          </>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>{row.restricted ? <ToneBadge tone="neutral" label="Restricted" /> : <ReportStatusBadge status={row.display_status} />}</TableCell>
      <TableCell>{row.applicable ? <DeadlineBadge daysRemaining={row.days_remaining} filed={row.filed} /> : "—"}</TableCell>
      {withActions && <TableCell />}
    </TableRow>
  );
}

/** A custom compliance requirement's row, with Edit and Mark filed for `cda:prepare`. */
export function RequirementRow({
  row,
  canPrepare,
  onEdit,
  onMarkFiled,
}: {
  row: CdaRequirement;
  canPrepare: boolean;
  onEdit: () => void;
  onMarkFiled: () => void;
}) {
  const status = requirementStatusMeta(row.display_status);
  return (
    <TableRow>
      <TableCell className="max-w-md">
        <span className="font-medium">{row.title}</span>
        <span className="block text-xs text-muted-foreground">
          Compliance requirement{row.reference && ` · ${row.reference}`}
        </span>
        {row.description && <span className="line-clamp-2 block text-xs text-muted-foreground">{row.description}</span>}
      </TableCell>
      <TableCell>{formatDate(row.default_due_on)}</TableCell>
      <TableCell>{row.extended_due_on ? formatDate(row.extended_due_on) : "—"}</TableCell>
      <TableCell>
        <ToneBadge tone={status.tone} label={status.label} />
        {row.filed_on && <span className="mt-1 block text-xs text-muted-foreground">Filed {formatDate(row.filed_on)}</span>}
      </TableCell>
      <TableCell>{row.applicable ? <DeadlineBadge daysRemaining={row.days_remaining} filed={row.filed} /> : "—"}</TableCell>
      {canPrepare && (
        <TableCell>
          <div className="flex justify-end gap-1">
            {row.status === "pending" && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onMarkFiled}>
                Mark filed
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onEdit} aria-label={`Edit ${row.title}`}>
              Edit
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
