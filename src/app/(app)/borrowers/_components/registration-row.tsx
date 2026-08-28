"use client";

import { ClipboardList, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TableCell } from "@/components/ui/table";
import { fileUrl } from "@/lib/file-url";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { Registration } from "@/services/registration.service";
import { reviewerLabel, statusBadgeColor } from "./utils";
import { getInitials } from "@/lib/initials";

/** The two registration statuses that get a tab of their own. */
export type RegistrationTabStatus = "pending" | "rejected";

export function fullNameOf(reg: Registration): string {
  return [reg.first_name, reg.middle_name, reg.last_name].filter(Boolean).join(" ");
}

function ApplicantCell({ reg, codePrefix }: { reg: Registration; codePrefix: string }) {
  const fullName = fullNameOf(reg);
  const photoSrc = fileUrl(reg.photo_url ?? reg.photo);
  return (
    <div className="flex items-center gap-3">
      <Avatar size="sm">
        {photoSrc ? <AvatarImage src={photoSrc} alt="" /> : null}
        <AvatarFallback className="bg-brand-orange/10 text-brand-orange text-xs font-semibold">
          {getInitials(fullName)}
        </AvatarFallback>
      </Avatar>
      <div>
        <p className="font-medium">{fullName}</p>
        <p className="text-xs text-muted-foreground font-mono">
          {codePrefix}-{String(reg.id).padStart(4, "0")}
        </p>
      </div>
    </div>
  );
}

/** Columns 1-3, identical for both statuses. */
export function SharedCells({
  reg,
  codePrefix,
  branchNameById,
  align,
}: {
  reg: Registration;
  codePrefix: string;
  branchNameById: Map<number, string>;
  /** Matches the variant's own cells; the rejected reason wraps to two lines. */
  align: "align-middle" | "align-top";
}) {
  const branchName =
    reg.branch_id != null ? branchNameById.get(reg.branch_id) : undefined;
  return (
    <>
      <TableCell className={align}>
        <ApplicantCell reg={reg} codePrefix={codePrefix} />
      </TableCell>
      <TableCell className={`text-muted-foreground ${align}`}>
        {reg.contact_number || "—"}
      </TableCell>
      <TableCell className={`text-muted-foreground ${align}`}>
        {branchName || "—"}
      </TableCell>
    </>
  );
}

function PendingCells({ reg }: { reg: Registration }) {
  return (
    <>
      <TableCell className="text-muted-foreground">{reg.email || "—"}</TableCell>
      <TableCell className="text-right tabular-nums text-brand-orange font-medium">
        {reg.monthly_income ? formatCurrency(reg.monthly_income) : "—"}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={statusBadgeColor.pending}>
          pending
        </Badge>
      </TableCell>
    </>
  );
}

function RejectedCells({ reg }: { reg: Registration }) {
  const reviewer = reviewerLabel(reg);
  return (
    <>
      <TableCell className="align-top">
        {reg.rejected_at ? (
          <>
            <p className="text-sm">
              <time dateTime={reg.rejected_at}>{formatDateTime(reg.rejected_at)}</time>
            </p>
            <p className="text-xs text-muted-foreground">
              by {reviewer ?? "an unrecorded reviewer"}
            </p>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      {/* `whitespace-normal` overrides TableCell's default `whitespace-nowrap`,
          which otherwise keeps the reason on one line and clips it mid-word with
          no ellipsis. The width cap sits on the <p>, not the cell: a table cell
          ignores max-width under `table-layout: auto`. */}
      <TableCell className="align-top whitespace-normal">
        {reg.rejection_reason ? (
          <p
            className="max-w-[26rem] text-sm text-muted-foreground line-clamp-2"
            title={reg.rejection_reason}
          >
            {reg.rejection_reason}
          </p>
        ) : (
          <span className="text-muted-foreground">No reason recorded</span>
        )}
      </TableCell>
    </>
  );
}

interface RegistrationVariant {
  /** Headers for the status-specific columns, in render order. */
  headers: { label: string; className?: string }[];
  /** Cells for those same columns. */
  Cells: (props: { reg: Registration }) => React.ReactNode;
  codePrefix: string;
  align: "align-middle" | "align-top";
  action: string;
  caption: string;
  empty: { Icon: typeof ClipboardList; title: string; hint: string };
}

/**
 * Everything that differs between the two application tabs, with each status's
 * headers and cells declared side by side in one object.
 *
 * Paired deliberately: a two-variant table whose `<TableHead>`s live in one
 * branch and whose `<TableCell>`s live in another can silently disagree on
 * column count, and a table with four headers over five cells renders skewed
 * with nothing failing. Keeping them in one literal makes adding a column a
 * single edit.
 */
export const REGISTRATION_VARIANTS: Record<RegistrationTabStatus, RegistrationVariant> = {
  pending: {
    headers: [
      { label: "Email" },
      { label: "Income", className: "text-right" },
      { label: "Status" },
    ],
    Cells: PendingCells,
    codePrefix: "PEND",
    align: "align-middle",
    action: "Review",
    caption: "Membership applications awaiting review",
    empty: {
      Icon: ClipboardList,
      title: "No pending registrations",
      hint: "New applications will appear here for review.",
    },
  },
  rejected: {
    headers: [{ label: "Rejected" }, { label: "Reason" }],
    Cells: RejectedCells,
    codePrefix: "REJ",
    align: "align-top",
    action: "View",
    caption: "Rejected membership applications",
    empty: {
      Icon: UserX,
      title: "No rejected applications",
      hint: "Applications you turn down are kept here, with the reason.",
    },
  },
};
