"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RouteGuard } from "@/components/common/route-guard";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Button } from "@/components/ui/button";
import { useApiResource, usePermission } from "@/hooks";
import { cicService } from "@/services";
import { formatDate, formatDateTime } from "@/lib/format";
import type { CicSubmission, CicSubmissionDetail } from "@/types/cic";
import { CicPageHeader } from "../../_components/page-header";
import { IssueList } from "../../_components/issue-list";
import { CORRECTABLE_STATUSES, SubmissionStatusBadge, submissionTypeLabel } from "../../_components/submission-status-badge";
import { useSubmissionActions } from "../../_hooks/use-submission-actions";
import { AcknowledgeDialog } from "./_components/acknowledge-dialog";

function Facts({ s }: { s: CicSubmission }) {
  const rows: [string, React.ReactNode][] = [
    ["Status", <SubmissionStatusBadge key="status" status={s.status} />],
    ["File Reference Date", formatDate(s.file_reference_date)],
    ["Submission type", `${s.submission_type} · ${submissionTypeLabel(s.submission_type)}`],
    ["Records", s.record_count],
    ["Errors / warnings", `${s.error_count} / ${s.warning_count}`],
    ["Comments", s.comments || "—"],
    ["Checksum (SHA-256)", <span key="sum" className="break-all font-mono text-xs">{s.checksum ?? "—"}</span>],
    ["Encrypted for key", <span key="key" className="break-all font-mono text-xs">{s.key_fingerprint ?? "Not encrypted yet"}</span>],
    ["Generated", `${formatDateTime(s.created_at)}${s.created_by ? ` by ${s.created_by}` : ""}`],
    ["Submitted to CIC", s.submitted_at ? formatDateTime(s.submitted_at) : "—"],
    ["CIC's answer", s.acknowledged_at ? formatDateTime(s.acknowledged_at) : "—"],
  ];
  if (s.acknowledgement_notes) rows.push(["CIC's notes", s.acknowledgement_notes]);
  if (s.corrects_submission_id) {
    rows.push([
      "Corrects",
      <Link key="corrects" href={`/cic/submissions/${s.corrects_submission_id}`} className="underline">
        Submission #{s.corrects_submission_id}
      </Link>,
    ]);
  }
  return (
    <dl className="grid max-w-2xl shrink-0 grid-cols-[11rem_1fr] gap-x-4 gap-y-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SubmissionContent({ id }: { id: number }) {
  const fetcher = useCallback(() => cicService.getSubmission(id), [id]);
  const resource = useApiResource<CicSubmissionDetail>(fetcher);
  // An action returns the submission without its issues; keep them from the load.
  const [updated, setUpdated] = useState<CicSubmission | null>(null);
  const actions = useSubmissionActions(setUpdated);
  const [acknowledging, setAcknowledging] = useState(false);
  const { can } = usePermission();

  return (
    <PageFill>
      <DataState resource={resource} summary="One CIC submission: its file, status and problems." endpoints={["GET /cic/submissions/{id}"]}>
        {(detail) => {
          const s: CicSubmission = updated ?? detail;
          return (
            <>
              <CicPageHeader
                title={s.filename}
                description="A Credit Submission Data File and its way to CIC."
                actions={
                  <>
                    {s.status === "generated" && (
                      <PermissionButton permission="cic:submit" disabled={actions.busy !== null} onClick={() => actions.encrypt(s)}>
                        {actions.busy === "encrypt" ? "Encrypting…" : "Encrypt File"}
                      </PermissionButton>
                    )}
                    {s.status !== "generated" && (
                      <PermissionButton
                        permission="cic:submit"
                        variant="outline"
                        disabled={actions.busy !== null}
                        onClick={() => actions.download(s)}
                      >
                        {actions.busy === "download" ? "Downloading…" : "Download Encrypted File"}
                      </PermissionButton>
                    )}
                    {s.status === "encrypted" && (
                      <PermissionButton permission="cic:submit" disabled={actions.busy !== null} onClick={() => actions.markSubmitted(s)}>
                        Mark Submitted to CIC
                      </PermissionButton>
                    )}
                    {s.status === "submitted" && (
                      <PermissionButton permission="cic:review" onClick={() => setAcknowledging(true)}>
                        Record CIC&apos;s Answer
                      </PermissionButton>
                    )}
                    {CORRECTABLE_STATUSES.has(s.status) && can("cic:prepare") && (
                      <Button
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={`/cic/generate?corrects=${s.id}&date=${s.file_reference_date}`} />}
                      >
                        Prepare Correction
                      </Button>
                    )}
                  </>
                }
              />
              <ScrollBox className="flex flex-col gap-6 p-px">
                <Facts s={s} />
                <section className="flex min-h-80 flex-col gap-2">
                  <h2 className="text-base font-semibold">Problems Found When Generated</h2>
                  <IssueList issues={detail.issues} csvName={`${s.filename.replace(/\.txt$/, "")}-issues.csv`} />
                </section>
              </ScrollBox>
              <AcknowledgeDialog
                open={acknowledging}
                onOpenChange={setAcknowledging}
                busy={actions.busy === "acknowledge"}
                onSave={(data) => actions.acknowledge(s, data)}
              />
            </>
          );
        }}
      </DataState>
    </PageFill>
  );
}

export default function CicSubmissionPage() {
  const params = useParams();
  const raw = typeof params.id === "string" ? params.id : "";
  const id = /^\d+$/.test(raw) ? Number(raw) : 0;
  return (
    <RouteGuard permission="cic:view" pageName="CIC Submission">
      {id > 0 ? (
        <SubmissionContent key={id} id={id} />
      ) : (
        <PageFill>
          <CicPageHeader title="CIC Submission" description="No submission at this address." />
        </PageFill>
      )}
    </RouteGuard>
  );
}
