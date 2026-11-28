"use client";

import { useCallback } from "react";
import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Button } from "@/components/ui/button";
import { useApiResource } from "@/hooks";
import { fetchAllPages } from "@/lib/paginate";
import { cicService } from "@/services";
import type { CicSubmissionRow } from "@/types/cic";
import { CicPageHeader } from "../_components/page-header";
import { SubmissionTable } from "../_components/submission-table";
import { CicGuard } from "../_components/cic-guard";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function CicCorrectionsContent() {
  const fetcher = useCallback(
    () =>
      fetchAllPages<CicSubmissionRow>(({ page, per_page }) =>
        cicService.submissionsPage({ page, per_page }),
      ),
    [],
  );
  const resource = useApiResource(fetcher);
  return (
    <PageFill>
      <CicPageHeader
        title="Corrections"
        description="Answer a file CIC rejected, or correct records already reported, with a correction file built from a new capture of the same month."
      />
      <DataState
        resource={resource}
        summary="Files CIC has received, and the corrections sent for them."
        endpoints={["GET /cic/submissions"]}
      >
        {(d) => {
          // The server says which files this caller can correct (`actions.correct`).
          const regular = d.rows.filter((s) => s.submission_type === 0 && s.actions.correct);
          const corrections = d.rows.filter((s) => s.submission_type === 1);
          return (
            <ScrollBox className="space-y-6 p-px">
              {d.truncated && (
                <IncompleteListNotice
                  shown={d.rows.length}
                  total={d.total}
                  noun="submissions"
                  consequence="The oldest files are missing from these lists."
                />
              )}
              <Section title="Files to Correct">
                {regular.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No file you can correct: only a file CIC has received can be.</p>
                ) : (
                  <div className="rounded-lg border">
                    <SubmissionTable
                      submissions={regular}
                      action={(s) => (
                        <Button
                          variant={s.status === "rejected" ? "default" : "outline"}
                          nativeButton={false}
                          render={<Link href={`/cic/corrections/new?corrects=${s.id}`} />}
                        >
                          Prepare Correction
                        </Button>
                      )}
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
    <CicGuard permission="cic:view" pageName="Corrections">
      <CicCorrectionsContent />
    </CicGuard>
  );
}
