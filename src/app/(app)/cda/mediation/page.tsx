"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CdaPage } from "../_components/cda-page";
import { ReportWorkspace } from "../_components/report-workspace";
import { PART_LABELS, REPORT_PAGES } from "../_lib/labels";
import { MediationCases } from "./_components/cases";

/** Mediation is two reports a year, one per half, each with its own deadline and workflow. */
export default function Page() {
  const page = REPORT_PAGES.mediation;
  const [version, setVersion] = useState(0);
  const changed = () => setVersion((v) => v + 1);
  return (
    <CdaPage title={page.title} description={page.description} restriction={page.restriction}>
      {(ctx) =>
        ctx && (
          <div className="space-y-6">
            <MediationCases key={ctx.year} year={ctx.year} onChanged={changed} />
            <Tabs defaultValue="h1">
              <TabsList>
                <TabsTrigger value="h1">{PART_LABELS.h1}</TabsTrigger>
                <TabsTrigger value="h2">{PART_LABELS.h2}</TabsTrigger>
              </TabsList>
              <TabsContent value="h1" className="pt-4">
                <ReportWorkspace key={`h1-${ctx.year}-${version}`} year={ctx.year} type="mediation" part="h1" />
              </TabsContent>
              <TabsContent value="h2" className="pt-4">
                <ReportWorkspace key={`h2-${ctx.year}-${version}`} year={ctx.year} type="mediation" part="h2" />
              </TabsContent>
            </Tabs>
          </div>
        )
      }
    </CdaPage>
  );
}
