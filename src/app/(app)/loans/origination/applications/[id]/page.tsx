"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { ScrollBox } from "@/components/common/page-fill";
import { ApplicationStatusBadge, AssessmentBadge, ToneBadge } from "@/components/loan-origination/badges";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiResource } from "@/hooks";
import { formatDateTime } from "@/lib/format";
import { loanOriginationService } from "@/services";
import type { ApplicationDetail } from "@/types/loan-origination";
import { ActivityPanel } from "./_components/activity-panel";
import { ApplicantOverview } from "./_components/applicant-overview";
import { ApplicationActions } from "./_components/application-actions";
import { AssessmentPanel } from "./_components/assessment-panel";
import { DocumentsPanel } from "./_components/documents-panel";

function Header({ a }: { a: ApplicationDetail }) {
  return (
    <div className="space-y-2">
      <Link
        href="/loans/origination/applications"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Applications
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{a.applicant_name || "Unnamed applicant"}</h1>
        <ApplicationStatusBadge status={a.status} />
        <AssessmentBadge result={a.assessment_result} />
        {a.linked_borrower_id && <ToneBadge tone="info">Existing member</ToneBadge>}
      </div>
      <p className="text-sm text-muted-foreground">
        {a.reference_number ?? `Draft #${a.id}`} · started {formatDateTime(a.started_at)}
        {a.submitted_at && <> · submitted {formatDateTime(a.submitted_at)}</>}
        {a.assigned_officer_name && <> · officer {a.assigned_officer_name}</>}
      </p>
      {a.loan_id && (
        <Link
          href={`/loans/${a.loan_id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-orange hover:underline"
        >
          Open the loan <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

/** Lists what still blocks the application, as the server reports it. */
function Missing({ a }: { a: ApplicationDetail }) {
  if (a.missing_fields.length === 0 && a.missing_documents.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <p className="font-medium">Still missing ({a.completion_percent}% complete)</p>
      <p>{[...a.missing_fields, ...a.missing_documents].join(", ")}</p>
    </div>
  );
}

export default function ApplicationDetailPage() {
  const id = Number(useParams<{ id: string }>().id);
  const fetcher = useCallback(() => loanOriginationService.getApplication(id), [id]);
  const resource = useApiResource(fetcher);
  const [tab, setTab] = useState("overview");

  return (
    <ScrollBox className="space-y-4">
      <DataState
        resource={resource}
        summary="The full application, with its documents, affordability assessment, notes and history, will show here once online applications are connected."
        endpoints={[`GET /loan-origination/applications/${id}`]}
      >
        {(a) => (
          <div className="space-y-4">
            <Header a={a} />
            <ApplicationActions application={a} onChanged={resource.refetch} />
            <Missing a={a} />
            <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
              <TabsList className="max-w-full justify-start overflow-x-auto">
                <TabsTrigger value="overview">Application</TabsTrigger>
                <TabsTrigger value="documents">Documents ({a.documents.length})</TabsTrigger>
                <TabsTrigger value="assessment">Assessment</TabsTrigger>
                <TabsTrigger value="activity">Notes and history</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <ApplicantOverview application={a} />
              </TabsContent>
              <TabsContent value="documents">
                <DocumentsPanel documents={a.documents} onChanged={resource.refetch} />
              </TabsContent>
              <TabsContent value="assessment">
                <AssessmentPanel applicationId={a.id} assessment={a.assessment} onChanged={resource.refetch} />
              </TabsContent>
              <TabsContent value="activity">
                <ActivityPanel notes={a.notes} history={a.history} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DataState>
    </ScrollBox>
  );
}
