"use client";

import Link from "next/link";
import { useState } from "react";
import { DataState } from "@/components/common/data-state";
import { FillSection, PageFill, ScrollBox } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiResource } from "@/hooks";
import type { AmlaSubjectRef } from "@/lib/amla/cdd-access";
import { amlaCddApi } from "@/lib/amla/cdd-api";
import { NO_BRANCH, amlaCddStatusTone, amlaCompletenessLines } from "@/lib/amla/cdd-view";
import { once } from "@/lib/amla/once";
import type { AmlaCddView } from "@/types/amla-cdd";
import { ChangesCard } from "./changes-card";
import { IdVerificationsCard } from "./id-verifications-card";
import { ProfileAnswersCard } from "./profile-answers-card";
import { ReviewsCard } from "./reviews-card";
import { RiskCard } from "./risk-card";

/**
 * One subject's CDD: the completeness check, the KYC answers, ID checks, the
 * AML risk assessment, reviews and the change history, one tab each. The server logs each
 * read, so the page reads once on open and once after each save, and keeps
 * the answers only in this component's state while it is open.
 */
export function CustomerProfileScreen({ subject }: { subject: AmlaSubjectRef }) {
  // A new one-shot read on open and after each save; the page is keyed by its subject.
  const [fetcher, setFetcher] = useState(() => once(() => amlaCddApi.show(subject)));
  const resource = useApiResource(fetcher);
  const reload = () => setFetcher(() => once(() => amlaCddApi.show(subject)));

  return (
    <PageFill>
      <Link href="/amla/customers" className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:underline">
        Back to Customers
      </Link>
      <DataState resource={resource} summary="This customer's due diligence and AML risk." endpoints={["GET /amla/cdd/{type}/{id}"]}>
        {(view) => <ProfileBody view={view} subject={subject} onChanged={reload} />}
      </DataState>
    </PageFill>
  );
}

function ProfileBody({ view, subject, onChanged }: { view: AmlaCddView; subject: AmlaSubjectRef; onChanged: () => void }) {
  const who = view.subject;
  const completeness = amlaCompletenessLines(view.completeness);
  const branch = who.branch?.name ?? NO_BRANCH;
  const place = who.type === "walk_in" ? `Walk-in · ${branch}` : [who.code, branch].filter(Boolean).join(" · ");
  const [tab, setTab] = useState("needs");

  return (
    <FillSection className="gap-4">
      <div className="shrink-0 space-y-1">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
          {who.name}
          <Badge variant={amlaCddStatusTone(view.cdd_status)}>{view.cdd_status_words}</Badge>
          {who.is_imported && <Badge variant="outline">Imported</Badge>}
        </h1>
        <p className="text-sm text-muted-foreground">
          {place}. ID: {view.id_state_words}.
        </p>
      </div>

      {/* Tabs, so at fit only the open tab's body scrolls, inside its own box. */}
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="max-w-full shrink-0 justify-start overflow-x-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="needs" className="min-h-0 flex-1">
          <ScrollBox className="h-full p-px">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">What CDD still needs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {completeness.complete && <p>{completeness.complete}</p>}
                {completeness.items.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5">
                    {completeness.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </ScrollBox>
        </TabsContent>
        <TabsContent value="answers" className="min-h-0 flex-1">
          <ScrollBox className="h-full p-px">
            <ProfileAnswersCard view={view} subject={subject} onSaved={onChanged} />
          </ScrollBox>
        </TabsContent>
        <TabsContent value="risk" className="min-h-0 flex-1">
          <ScrollBox className="h-full p-px">
            <RiskCard view={view} subject={subject} onAssessed={onChanged} />
          </ScrollBox>
        </TabsContent>
        <TabsContent value="ids" className="min-h-0 flex-1">
          <ScrollBox className="h-full p-px">
            <IdVerificationsCard view={view} subject={subject} onRecorded={onChanged} />
          </ScrollBox>
        </TabsContent>
        <TabsContent value="reviews" className="min-h-0 flex-1">
          <ScrollBox className="h-full p-px">
            <ReviewsCard view={view} subject={subject} onRecorded={onChanged} />
          </ScrollBox>
        </TabsContent>
        <TabsContent value="changes" className="min-h-0 flex-1">
          <ScrollBox className="h-full p-px">
            <ChangesCard changes={view.changes} />
          </ScrollBox>
        </TabsContent>
      </Tabs>
    </FillSection>
  );
}

const TABS = [
  { value: "needs", label: "What's needed" },
  { value: "answers", label: "Answers" },
  { value: "risk", label: "AML risk" },
  { value: "ids", label: "ID checks" },
  { value: "reviews", label: "Reviews" },
  { value: "changes", label: "Changes" },
];
