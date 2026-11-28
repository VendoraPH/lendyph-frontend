"use client";

import { useCallback } from "react";
import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Button } from "@/components/ui/button";
import { useApiResource, usePermission } from "@/hooks";
import { fetchAllPages } from "@/lib/paginate";
import { cicService } from "@/services";
import type { CicSubmissionRow } from "@/types/cic";
import { CicPageHeader } from "../_components/page-header";
import { SubmissionTable } from "../_components/submission-table";
import { CicGuard } from "../_components/cic-guard";

/** Files CIC has seen; only these can be answered with a correction file (the server checks again). */
const SEEN_BY_CIC = new Set<CicSubmissionRow["status"]>(["submitted", "accepted", "rejected"]);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function CicCorrectionsContent() {
  const { can } = usePermission();
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
          const regular = d.rows.filter((s) => s.submission_type === 0 && SEEN_BY_CIC.has(s.status));
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
                  <p className="text-sm text-muted-foreground">No file has been submitted to CIC yet.</p>
                ) : (
                  <div className="rounded-lg border">
                    <SubmissionTable
                      submissions={regular}
                      action={(s) =>
                        can("cic:prepare") ? (
                          <Button
                            variant={s.status === "rejected" ? "default" : "outline"}
                            nativeButton={false}
                            render={<Link href={`/cic/generate?corrects=${s.id}`} />}
                          >
                            Prepare Correction
                          </Button>
                        ) : null
                      }
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
