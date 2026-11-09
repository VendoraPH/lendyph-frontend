"use client";

import { useCallback, useState } from "react";
import { Gauge } from "lucide-react";
import { CollapsibleCard } from "@/components/common/collapsible-card";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Separator } from "@/components/ui/separator";
import { env } from "@/config/env";
import { useApiResource, usePermission } from "@/hooks";
import { notifySuccess } from "@/lib/notify";
import { creditScoringService } from "@/services";
import {
  assessmentBody,
  assessmentFormFrom,
  assessmentSaveErrors,
  canSaveAssessment,
  memberDetailsHidden,
  NO_SCORE_DECISION_REASON,
  showsCreditAssessment,
  type AssessmentForm,
} from "@/lib/credit-scoring/assessment-card";
import { ScoreDetail } from "@/app/(app)/credit-scoring/_components/score-detail";
import { CapacitySection } from "@/app/(app)/credit-scoring/_components/capacity-section";
import { PolicyFlagAlert } from "@/app/(app)/credit-scoring/_components/policy-flag-alert";
import { DecisionList } from "@/app/(app)/credit-scoring/_components/decision-list";
import { AssessmentFormFields } from "@/app/(app)/credit-scoring/_components/assessment-form";
import { ManualOverrideDialog } from "@/app/(app)/credit-scoring/borrowers/[id]/_components/manual-override-dialog";
import type { Permission } from "@/types";
import type { LoanCreditAssessment } from "@/types/credit-scoring";

interface CreditAssessmentCardProps {
  loanId: number;
  status: string | null | undefined;
}

/**
 * The loan application's credit assessment: advisory only, it never changes
 * the loan. Renders nothing, and asks for nothing, unless Credit Scoring is
 * switched on, the loan is a draft or for approval, and the user can read
 * both credit scores and loans.
 */
export function CreditAssessmentCard({ loanId, status }: CreditAssessmentCardProps) {
  const { can } = usePermission();
  if (!showsCreditAssessment({ flagOn: env.features.creditScoring, status, can })) return null;
  return <CreditAssessmentBody loanId={loanId} canSave={canSaveAssessment(can)} can={can} />;
}

function CreditAssessmentBody({
  loanId,
  canSave,
  can,
}: {
  loanId: number;
  canSave: boolean;
  can: (permission: Permission) => boolean;
}) {
  const fetcher = useCallback(() => creditScoringService.getLoanAssessment(loanId), [loanId]);
  const resource = useApiResource<LoanCreditAssessment>(fetcher);
  // The PUT answers the whole assessment, which is shown as it came back.
  const [saved, setSaved] = useState<LoanCreditAssessment | null>(null);
  const [draft, setDraft] = useState<AssessmentForm | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);

  async function handleSave(form: AssessmentForm, loaded: AssessmentForm, detailsHidden: boolean) {
    setSaving(true);
    setErrors([]);
    try {
      const next = await creditScoringService.saveLoanAssessment(loanId, assessmentBody(form, loaded, { memberDetailsHidden: detailsHidden }));
      setSaved(next);
      setDraft(null);
      notifySuccess("Credit assessment saved.");
    } catch (err: unknown) {
      setErrors(assessmentSaveErrors(err));
    } finally {
      setSaving(false);
    }
  }

  function reload() {
    setSaved(null);
    resource.refetch();
  }

  const current = saved ?? resource.data;
  const view = current ? { ...resource, data: current } : resource;

  return (
    <CollapsibleCard icon={<Gauge className="h-4 w-4 text-muted-foreground" />} title="Credit Assessment">
      <DataState
        resource={view}
        summary="This application's credit score, capacity to pay, flags and decisions."
        endpoints={[`GET /credit-scoring/loans/${loanId}/assessment`]}
      >
        {(assessment) => {
          const loaded = assessmentFormFrom(assessment.application_profile);
          const detailsHidden = memberDetailsHidden(assessment, can);
          const form = draft ?? loaded;
          const score = assessment.score;
          return (
            <div className="space-y-6">
              {errors.length > 0 && (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {errors.map((m) => (
                    <p key={m}>{m}</p>
                  ))}
                </div>
              )}

              {score ? (
                <ScoreDetail score={score} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not assessed yet. Save the application&apos;s details below to assess it.
                </p>
              )}

              <CapacitySection capacity={assessment.capacity} financialsHidden={score?.financials_hidden ?? false} />

              <section aria-labelledby="assessment-flags-heading" className="space-y-2">
                <h3 id="assessment-flags-heading" className="text-sm font-medium">
                  Policy Flags
                </h3>
                {assessment.policy_flags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open policy flags.</p>
                ) : (
                  <PolicyFlagAlert flags={assessment.policy_flags} />
                )}
              </section>

              <section aria-labelledby="assessment-decisions-heading" className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id="assessment-decisions-heading" className="text-sm font-medium">
                    Decisions
                  </h3>
                  <PermissionButton
                    permission="credit_scoring:override"
                    size="sm"
                    variant="outline"
                    disabled={!score?.id}
                    aria-describedby={score?.id ? undefined : "assessment-decision-reason"}
                    onClick={() => setDecisionOpen(true)}
                  >
                    Record Decision
                  </PermissionButton>
                </div>
                {!score?.id && (
                  <p id="assessment-decision-reason" className="text-xs text-muted-foreground">
                    {NO_SCORE_DECISION_REASON}
                  </p>
                )}
                <DecisionList decisions={assessment.decisions} total={assessment.decisions_total} />
              </section>

              {assessment.editable && (
                <>
                  <Separator />
                  <AssessmentFormFields
                    assessment={assessment}
                    form={form}
                    canSave={canSave}
                    detailsHidden={detailsHidden}
                    saving={saving}
                    onChange={setDraft}
                    onSave={() => handleSave(form, loaded, detailsHidden)}
                  />
                </>
              )}

              {score && score.id !== null && (
                <ManualOverrideDialog
                  open={decisionOpen}
                  onOpenChange={setDecisionOpen}
                  borrowerId={assessment.borrower_id}
                  creditScoreId={score.id}
                  loanId={assessment.loan_id}
                  onDecisionRecorded={reload}
                />
              )}
            </div>
          );
        }}
      </DataState>
    </CollapsibleCard>
  );
}
