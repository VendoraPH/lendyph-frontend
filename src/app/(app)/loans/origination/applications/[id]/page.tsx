"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { ScrollBox } from "@/components/common/page-fill";
import { ApplicationStatusBadge, AssessmentBadge, TestBadge, ToneBadge } from "@/components/loan-origination/badges";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiResource, usePermission } from "@/hooks";
import { formatDateTime } from "@/lib/format";
import { loanOriginationService } from "@/services";
import type { ApplicationDetail } from "@/types/loan-origination";
import { NOT_FOUND, isMissing, missingFieldLabel, orMissing } from "../../_lib/application-view";
import { ActivityPanel } from "./_components/activity-panel";
import { ApplicantOverview } from "./_components/applicant-overview";
import { ApplicationActions } from "./_components/application-actions";
import { AssessmentPanel } from "./_components/assessment-panel";
import { DocumentsPanel } from "./_components/documents-panel";
import { MessagesPanel } from "./_components/messages-panel";

function Header({ a }: { a: ApplicationDetail }) {
  const seesMembers = usePermission().can("borrowers:view");
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
        <ApplicationStatusBadge status={a.status} label={a.status_label} />
        <AssessmentBadge result={a.assessment?.result ?? a.assessment_result} label={a.assessment?.result_label} />
        {a.is_test && <TestBadge />}
        {a.linked_borrower_id !== null &&
          (seesMembers ? (
            <Link href={`/borrowers/${a.linked_borrower_id}`} className="text-sm font-medium text-brand-orange hover:underline">
              Linked member
            </Link>
          ) : (
            <ToneBadge tone="info">Linked member</ToneBadge>
          ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {a.reference_number ?? `Draft #${a.id}`}
        {a.started_at && <> · started {formatDateTime(a.started_at)}</>}
        {a.submitted_at && <> · submitted {formatDateTime(a.submitted_at)}</>}
        {a.assigned_officer_name && <> · officer {a.assigned_officer_name}</>}
      </p>
      {a.loan_id !== null && (
        <Link
          href={`/loans/${a.loan_id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-orange hover:underline"
        >
          Open loan <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

/** What still blocks a submit, as the server reports it. */
function Missing({ a }: { a: ApplicationDetail }) {
  if (a.missing_fields.length === 0 && a.missing_documents.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <p className="font-medium">Still missing ({a.completion_percent}% complete)</p>
      {a.missing_fields.length > 0 && <p>Details: {a.missing_fields.map(missingFieldLabel).join(", ")}</p>}
      {a.missing_documents.length > 0 && <p>Documents: {a.missing_documents.join(", ")}</p>}
    </div>
  );
}

/** A 404: no such application, or another branch's. Not "not connected yet", which is a 501. */
function NotFound() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="font-medium">{NOT_FOUND}</p>
        <Link href="/loans/origination/applications" className="inline-flex items-center gap-1 text-sm font-medium text-brand-orange hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Applications
        </Link>
      </CardContent>
    </Card>
  );
}

/** The loaded application. The tab lives in the page, so a reload after an action keeps it. */
function ApplicationView({
  a,
  tab,
  onTab,
  onChanged,
}: {
  a: ApplicationDetail;
  tab: string;
  onTab: (tab: string) => void;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-4">
      <Header a={a} />
      <ApplicationActions application={a} onChanged={onChanged} />
      <Missing a={a} />
      <Tabs value={tab} onValueChange={(v) => onTab(String(v))}>
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Application</TabsTrigger>
          <TabsTrigger value="documents">Documents ({a.documents.length})</TabsTrigger>
          <TabsTrigger value="assessment">Assessment</TabsTrigger>
          <TabsTrigger value="messages">Messages ({a.applicant_messages.length})</TabsTrigger>
          <TabsTrigger value="activity">Notes and history</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <ApplicantOverview application={a} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsPanel application={a} onChanged={onChanged} />
        </TabsContent>
        <TabsContent value="assessment">
          <AssessmentPanel application={a} onChanged={onChanged} />
        </TabsContent>
        <TabsContent value="messages">
          <MessagesPanel messages={a.applicant_messages} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityPanel notes={a.notes} history={a.history} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ApplicationDetailPage() {
  const id = Number(useParams<{ id: string }>().id);
  const fetcher = useCallback(() => orMissing(loanOriginationService.getApplication(id)), [id]);
  const resource = useApiResource(fetcher);
  const [tab, setTab] = useState("overview");

  return (
    <ScrollBox className="space-y-4">
      <DataState
        resource={resource}
        summary="The full application, with its documents, assessment, messages, notes and history, will show here once online applications are connected."
        endpoints={[`GET /loan-origination/applications/${id}`]}
      >
        {(a) => (isMissing(a) ? <NotFound /> : <ApplicationView a={a} tab={tab} onTab={setTab} onChanged={resource.refetch} />)}
      </DataState>
    </ScrollBox>
  );
}
