"use client";

import Link from "next/link";
import { useState } from "react";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource, usePermission } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { amlaCaseAccess, amlaReportActions } from "@/lib/amla/case-access";
import { amlaCaseApi, readBlobError } from "@/lib/amla/case-api";
import { amlaReportFacts, amlaReportRow } from "@/lib/amla/case-view";
import { amlaMonitoringAccess } from "@/lib/amla/monitoring-access";
import { once } from "@/lib/amla/once";
import { notifyError, notifySuccess } from "@/lib/notify";
import { saveBlob } from "@/lib/save-blob";
import { useAuthStore } from "@/store";
import type { AmlaReportDetail } from "@/types/amla-cases";
import { AmlaNoteDialog, type AmlaNoteAction } from "../../settings/amla/_components/amla-note-dialog";
import { CddFormDialog } from "../customers/_components/cdd-form-dialog";
import { FilingFieldsCard, FilingStepsCard } from "./filing-sections";
import { SubmissionDialog } from "./submission-dialog";

/**
 * One CTR or STR: its fields, an STR's narrative (for its key holders only),
 * the deadline, approval and every filing step. Read once on open; each step
 * shows the report the server answers with, without reading it again.
 */
export function FilingDetail({ id }: { id: number }) {
  const [fetcher] = useState(() => once(() => amlaCaseApi.report(id)));
  const resource = useApiResource(fetcher);
  const [latest, setLatest] = useState<AmlaReportDetail | null>(null);
  return (
    <PageFill>
      <Link href="/amla/submissions" className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:underline">
        Back to Regulatory Submissions
      </Link>
      <DataState resource={resource} summary="This report, its deadline and its filing steps." endpoints={["GET /amla/reports/{id}"]}>
        {(report) => <FilingBody report={latest ?? report} onReport={setLatest} />}
      </DataState>
    </PageFill>
  );
}

type Dialog = "approve" | "step" | null;

function FilingBody({ report, onReport }: { report: AmlaReportDetail; onReport: (next: AmlaReportDetail) => void }) {
  const { can } = usePermission();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [returning, setReturning] = useState<AmlaNoteAction | null>(null);
  const { submitting, run } = useSubmitGuard();
  const actions = amlaReportActions(report, userId, can);
  const row = amlaReportRow(report);
  const done = (next: AmlaReportDetail) => {
    setDialog(null);
    setReturning(null);
    onReport(next);
  };
  const caseHref = report.case_id !== null && amlaCaseAccess(can).cases ? `/amla/cases/${report.case_id}` : null;
  const candidateHref =
    report.ctr_candidate_id !== null && amlaMonitoringAccess(can).ctr ? `/amla/ctr-candidates/${report.ctr_candidate_id}` : null;

  const exportCopy = () =>
    amlaCaseApi
      .exportReport(report.id)
      .then((blob) => saveBlob(blob, `${report.reference}-internal-review.json`))
      .catch(async (err: unknown) => notifyError(await readBlobError(err), "The review copy couldn't be exported."));

  return (
    <ScrollBox className="space-y-4 p-px">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {report.reference}
            <Badge variant={row.tone}>{row.status}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {row.type}
            {caseHref && (
              <>
                {" · "}
                <Link href={caseHref} className="underline-offset-4 hover:underline">
                  Open its case
                </Link>
              </>
            )}
            {candidateHref && (
              <>
                {" · "}
                <Link href={candidateHref} className="underline-offset-4 hover:underline">
                  Open its CTR candidate
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.approve && (
            <Button size="sm" onClick={() => setDialog("approve")}>
              Approve
            </Button>
          )}
          {actions.return && (
            <Button size="sm" variant="outline" onClick={() => setReturning(returnAction(report))}>
              Return to preparer
            </Button>
          )}
          {actions.record.length > 0 && (
            <Button size="sm" onClick={() => setDialog("step")}>
              Record filing step
            </Button>
          )}
          {actions.export && (
            <Button size="sm" variant="outline" onClick={exportCopy}>
              Export review copy
            </Button>
          )}
        </div>
      </div>

      {!report.format.file_available && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm">
          The AMLC file format isn&apos;t built, so an export is an internal review copy only. File the report by hand on the AMLC
          portal, then record each step here with its reference and evidence.
        </p>
      )}
      {report.returned_reason && (
        <p className="rounded-md border border-destructive/40 p-3 text-sm whitespace-pre-wrap">Returned: {report.returned_reason}</p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deadline and approval</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,12rem)_1fr]">
              {amlaReportFacts(report).map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {row.dueNotes.map((note) => (
              <p key={note} className="text-xs text-muted-foreground">
                {note}
              </p>
            ))}
          </CardContent>
        </Card>
        <FilingFieldsCard fields={report.fields} />
        {actions.narrative && report.narrative && (
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Narrative</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{report.narrative}</p>
            </CardContent>
          </Card>
        )}
        <FilingStepsCard report={report} />
      </div>

      <CddFormDialog
        open={dialog === "approve"}
        title="Approve this report?"
        description="It becomes ready for filing on the AMLC portal. Nothing is filed by itself."
        submitLabel="Approve"
        submitting={submitting}
        error={null}
        onClose={() => setDialog(null)}
        onSubmit={() =>
          run(() => amlaCaseApi.approveReport(report.id))
            ?.then((next) => {
              notifySuccess("Report approved, ready for filing");
              done(next);
            })
            .catch((err: unknown) => notifyError(err, "The report couldn't be approved."))
        }
      >
        <p className="text-sm">{report.reference}</p>
      </CddFormDialog>
      <SubmissionDialog open={dialog === "step"} report={report} steps={actions.record} onClose={() => setDialog(null)} onRecorded={done} />
      <AmlaNoteDialog action={returning} onClose={() => setReturning(null)} onDone={() => setReturning(null)} />
    </ScrollBox>
  );

  function returnAction(current: AmlaReportDetail): AmlaNoteAction {
    return {
      title: "Return this report to its preparer?",
      description: "Say what needs changing. A returned CTR's candidate can be prepared again; a returned STR can be prepared again from its case.",
      label: "Reason",
      required: true,
      confirmLabel: "Return",
      destructive: true,
      success: "Report returned to its preparer",
      failure: "The report couldn't be returned.",
      run: (text) => amlaCaseApi.returnReport(current.id, text).then(done),
    };
  }
}
