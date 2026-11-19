"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { amlaCaseApi, readBlobError } from "@/lib/amla/case-api";
import { amlaMonitoringApi } from "@/lib/amla/monitoring-api";
import { amlaAlertRow, amlaEscalationNotes } from "@/lib/amla/monitoring-view";
import { once } from "@/lib/amla/once";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatFileSize } from "@/lib/loan-origination";
import { notifyError } from "@/lib/notify";
import { saveBlob } from "@/lib/save-blob";
import { useApiResource } from "@/hooks";
import type { AmlaCaseDetail } from "@/types/amla-cases";
import type { AmlaAlertHistoryStep } from "@/types/amla-monitoring";

const at = (value: string | null) => (value ? formatDateTime(value) : "—");

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <p className="text-muted-foreground">{children}</p>;

export function CaseDecisionCard({ record }: { record: AmlaCaseDetail }) {
  if (record.decision === null) {
    return (
      <Section title="Decision">
        <Empty>No decision yet. Someone holding AMLA report approval records it, with the reason.</Empty>
      </Section>
    );
  }
  return (
    <Section title="Decision">
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,10rem)_1fr]">
        <dt className="text-muted-foreground">Decision</dt>
        <dd>{record.decision_words}</dd>
        {record.determination_date && (
          <>
            <dt className="text-muted-foreground">Determination date</dt>
            <dd>{formatDate(record.determination_date)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Decided by</dt>
        <dd>{record.decided_by?.name ?? "—"}</dd>
        <dt className="text-muted-foreground">Reason</dt>
        <dd className="whitespace-pre-wrap">{record.decision_reason}</dd>
      </dl>
    </Section>
  );
}

export function CaseAlertsCard({ record, canOpenAlerts }: { record: AmlaCaseDetail; canOpenAlerts: boolean }) {
  return (
    <Section title="Alerts linked">
      {record.alerts.length === 0 ? (
        <Empty>No alerts are linked to this case.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alert</TableHead>
              <TableHead>Rule</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {record.alerts.map(amlaAlertRow).map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {canOpenAlerts ? (
                    <Link href={row.href} className="font-medium underline-offset-4 hover:underline">
                      {row.reference}
                    </Link>
                  ) : (
                    row.reference
                  )}
                  <div className="text-xs text-muted-foreground">{row.status}</div>
                  {canOpenAlerts && <EscalationNote alertId={row.id} caseId={record.id} />}
                </TableCell>
                <TableCell className="whitespace-normal">{row.rule}</TableCell>
                <TableCell>
                  <Badge variant={row.tone}>{row.priority}</Badge>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">{row.amount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}

export function CaseNotesCard({ record }: { record: AmlaCaseDetail }) {
  return (
    <Section title="Investigation notes">
      {record.notes.length === 0 ? (
        <Empty>No notes yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {record.notes.map((note) => (
            <li key={note.id} className="rounded-md border p-3">
              <p className="whitespace-pre-wrap">{note.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {note.by?.name ?? "—"} · {at(note.at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function downloadEvidence(caseId: number, evidenceId: number, name: string) {
  amlaCaseApi
    .caseEvidence(caseId, evidenceId)
    .then((blob) => saveBlob(blob, name))
    .catch(async (err: unknown) => notifyError(await readBlobError(err), "The file couldn't be downloaded."));
}

export function CaseEvidenceCard({ record }: { record: AmlaCaseDetail }) {
  return (
    <Section title="Evidence">
      {record.evidence.length === 0 ? (
        <Empty>No evidence yet. Files are kept with the case, never on the member&apos;s record.</Empty>
      ) : (
        <ul className="divide-y">
          {record.evidence.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[file.description, formatFileSize(file.size), file.by?.name, at(file.at)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => downloadEvidence(record.id, file.id, file.name)}>
                Download
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function CaseHistoryCard({ record }: { record: AmlaCaseDetail }) {
  return (
    <Section title="History">
      <ol className="space-y-1">
        {record.history.map((step, index) => (
          <li key={`${step.action}-${index}`} className="flex flex-wrap justify-between gap-2">
            <span>{step.action_words}</span>
            <span className="text-muted-foreground">
              {step.by?.name ?? "System"} · {at(step.at)}
            </span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function CaseReportsCard({ record, canOpen }: { record: AmlaCaseDetail; canOpen: boolean }) {
  if (record.reports.length === 0) return null;
  return (
    <Section title="STR">
      <ul className="space-y-1">
        {record.reports.map((report) => (
          <li key={report.id} className="flex flex-wrap justify-between gap-2">
            {canOpen ? (
              <Link href={`/amla/filings/${report.id}`} className="font-medium underline-offset-4 hover:underline">
                {report.reference}
              </Link>
            ) : (
              <span className="font-medium">{report.reference}</span>
            )}
            <span className="text-muted-foreground">{report.status_words}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const NO_HISTORY = () => Promise.resolve<AmlaAlertHistoryStep[]>([]);

/**
 * The note typed when the alert was escalated: the server keeps it on the
 * alert's history, not among the case's notes. That history read is logged,
 * so it is made only when asked for, once.
 */
function EscalationNote({ alertId, caseId }: { alertId: number; caseId: number }) {
  const [fetcher, setFetcher] = useState<(() => Promise<AmlaAlertHistoryStep[]>) | null>(null);
  const history = useApiResource(fetcher ?? NO_HISTORY, fetcher !== null);
  if (fetcher === null) {
    return (
      <Button variant="link" size="sm" className="h-auto px-0 text-xs" onClick={() => setFetcher(() => once(() => amlaMonitoringApi.alertHistory(alertId)))}>
        Show escalation note
      </Button>
    );
  }
  if (history.loading) return <p className="text-xs text-muted-foreground">Loading…</p>;
  if (history.error) return <p className="text-xs text-destructive">{history.error}</p>;
  const notes = amlaEscalationNotes(history.data ?? [], caseId);
  if (notes.length === 0) return <p className="text-xs text-muted-foreground">No note was written when it was escalated.</p>;
  return (
    <>
      {notes.map((step) => (
        <p key={step.id} className="text-xs whitespace-pre-wrap">
          Escalation note ({step.by?.name ?? "—"}): {step.note}
        </p>
      ))}
    </>
  );
}
