"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Button } from "@/components/ui/button";
import { useApiResource, usePermission } from "@/hooks";
import { cicService } from "@/services";
import { formatDateTime } from "@/lib/format";
import type { CicSubmissionDetail } from "@/types/cic";
import { CicPageHeader } from "../../_components/page-header";
import { SubmissionReview } from "../../_components/submission-review";
import { SubmissionStatusBadge } from "../../_components/submission-status-badge";
import { useSubmissionActions } from "../../_hooks/use-submission-actions";
import { staffName } from "../../_lib/labels";
import { AcknowledgeDialog } from "./_components/acknowledge-dialog";
import { EncryptDialog } from "./_components/encrypt-dialog";
import { StatusHistory } from "./_components/status-history";
import { CicGuard } from "../../_components/cic-guard";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** The actions the server offers this caller now (`actions`); nothing else shows. */
function Actions({
  s,
  canSubmit,
  busy,
  onEncrypt,
  onDownload,
  onSubmit,
  onAcknowledge,
}: {
  s: CicSubmissionDetail;
  /** Opens the review even when the server can't encrypt yet, so it says why. */
  canSubmit: boolean;
  busy: string | null;
  onEncrypt: () => void;
  onDownload: () => void;
  onSubmit: () => void;
  onAcknowledge: () => void;
}) {
  return (
    <>
      {s.status === "generated" && canSubmit && (
        <Button disabled={busy !== null} onClick={onEncrypt}>
          Review and Encrypt
        </Button>
      )}
      {s.actions.download && (
        <Button variant="outline" disabled={busy !== null} onClick={onDownload}>
          {busy === "download" ? "Downloading…" : "Download Encrypted File"}
        </Button>
      )}
      {s.actions.mark_submitted && (
        <Button disabled={busy !== null} onClick={onSubmit}>
          {busy === "submit" ? "Saving…" : "Mark Submitted to CIC"}
        </Button>
      )}
      {s.actions.acknowledge && (
        <Button disabled={busy !== null} onClick={onAcknowledge}>
          Record CIC&apos;s Answer
        </Button>
      )}
      {s.actions.correct && (
        <Button variant="outline" nativeButton={false} render={<Link href={`/cic/generate?corrects=${s.id}`} />}>
          Prepare Correction
        </Button>
      )}
    </>
  );
}

function SubmissionContent({ id }: { id: number }) {
  const fetcher = useCallback(() => cicService.getSubmission(id), [id]);
  const resource = useApiResource(fetcher);
  // An action answers with the updated detail; show it instead of the load.
  const [updated, setUpdated] = useState<CicSubmissionDetail | null>(null);
  const actions = useSubmissionActions(setUpdated);
  const [acknowledging, setAcknowledging] = useState(false);
  const [encrypting, setEncrypting] = useState(false);
  const { can } = usePermission();

  return (
    <PageFill>
      <DataState resource={resource} summary="One CIC file: its review, status and history." endpoints={["GET /cic/submissions/{id}"]}>
        {(loaded) => {
          const s = updated ?? loaded;
          return (
            <>
              <CicPageHeader
                title={s.reference}
                description={s.encrypted_filename ?? s.filename}
                actions={
                  <Actions
                    s={s}
                    canSubmit={can("cic:submit")}
                    busy={actions.busy}
                    onEncrypt={() => setEncrypting(true)}
                    onDownload={() => actions.download(s)}
                    onSubmit={() => actions.markSubmitted(s)}
                    onAcknowledge={() => setAcknowledging(true)}
                  />
                }
              />
              <ScrollBox className="space-y-6 p-px">
                <Section title="Status">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <SubmissionStatusBadge status={s.status} label={s.status_label} />
                    <span className="text-muted-foreground">
                      Downloaded {s.download_count} {s.download_count === 1 ? "time" : "times"}
                    </span>
                  </div>
                  {s.cic_reference_no && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">CIC reference number: </span>
                      <span className="font-mono">{s.cic_reference_no}</span>
                    </p>
                  )}
                  {s.acknowledgement_notes && (
                    <p className="max-w-3xl text-sm">
                      <span className="text-muted-foreground">CIC&apos;s notes: </span>
                      {s.acknowledgement_notes}
                    </p>
                  )}
                  {s.acknowledged_at && (
                    <p className="text-sm text-muted-foreground">
                      Recorded {formatDateTime(s.acknowledged_at)}
                      {s.acknowledged_by ? ` by ${staffName(s.acknowledged_by)}` : ""}
                    </p>
                  )}
                  <StatusHistory history={s.history} />
                </Section>
                <Section title="Review">
                  <SubmissionReview detail={s} />
                </Section>
                {s.corrections.length > 0 && (
                  <Section title="Corrections Sent for This File">
                    <ul className="space-y-1 text-sm">
                      {s.corrections.map((c) => (
                        <li key={c.id}>
                          <Link href={`/cic/submissions/${c.id}`} className="underline">
                            {c.reference}
                          </Link>{" "}
                          <span className="text-muted-foreground">
                            · {c.status_label} · generated {formatDateTime(c.generated_at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
              </ScrollBox>
              <EncryptDialog
                open={encrypting}
                onOpenChange={setEncrypting}
                detail={s}
                busy={actions.busy === "encrypt"}
                onEncrypt={() => actions.encrypt(s)}
              />
              {s.actions.acknowledge && (
                <AcknowledgeDialog
                  open={acknowledging}
                  onOpenChange={setAcknowledging}
                  busy={actions.busy === "acknowledge"}
                  onSave={(data) => actions.acknowledge(s, data)}
                />
              )}
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
    <CicGuard permission="cic:view" pageName="Submission History">
      {id > 0 ? (
        <SubmissionContent key={id} id={id} />
      ) : (
        <PageFill>
          <CicPageHeader title="CIC Submission" description="No submission at this address." />
        </PageFill>
      )}
    </CicGuard>
  );
}
