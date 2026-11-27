"use client";

import Link from "next/link";
import { RouteGuard } from "@/components/common/route-guard";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/hooks";
import { CicPageHeader } from "../_components/page-header";
import { CORRECTABLE_STATUSES } from "../_components/submission-status-badge";
import { SubmissionTable } from "../_components/submission-table";
import { CIC_SUBMISSION_ENDPOINTS, useCicSubmissions } from "../_hooks/use-cic-submissions";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function CicCorrectionsContent() {
  const resource = useCicSubmissions();
  const { can } = usePermission();
  return (
    <PageFill>
      <CicPageHeader
        title="Corrections"
        description="Answer a file CIC rejected, or correct records already reported, with a correction file."
      />
      <DataState resource={resource} summary="Files CIC has received, and the corrections sent for them." endpoints={CIC_SUBMISSION_ENDPOINTS}>
        {(d) => {
          const regular = d.rows.filter((s) => s.submission_type === 0 && CORRECTABLE_STATUSES.has(s.status));
          const corrections = d.rows.filter((s) => s.submission_type === 1);
          const correctedBy = new Map(corrections.map((c) => [c.corrects_submission_id, c]));
          return (
            <ScrollBox className="space-y-6 p-px">
              <Section title="Files to Correct">
                {regular.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No submitted file yet.</p>
                ) : (
                  <div className="rounded-lg border">
                    <SubmissionTable
                      submissions={regular}
                      action={(s) => {
                        const existing = correctedBy.get(s.id);
                        if (existing) {
                          return (
                            <Link href={`/cic/submissions/${existing.id}`} className="text-sm underline">
                              Corrected
                            </Link>
                          );
                        }
                        return can("cic:prepare") ? (
                          <Button
                            size="sm"
                            variant={s.status === "rejected" ? "default" : "outline"}
                            nativeButton={false}
                            render={<Link href={`/cic/generate?corrects=${s.id}&date=${s.file_reference_date}`} />}
                          >
                            Prepare Correction
                          </Button>
                        ) : null;
                      }}
                    />
                  </div>
                )}
              </Section>
              <Section title="Correction Files">
                {corrections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No correction file has been generated.</p>
                ) : (
                  <div className="rounded-lg border">
                    <SubmissionTable submissions={corrections} />
                  </div>
                )}
              </Section>
            </ScrollBox>
          );
        }}
      </DataState>
    </PageFill>
  );
}

export default function CicCorrectionsPage() {
  return (
    <RouteGuard permission="cic:view" pageName="CIC Corrections">
      <CicCorrectionsContent />
    </RouteGuard>
  );
}
