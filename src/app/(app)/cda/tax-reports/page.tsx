"use client";

import { Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CdaPage } from "../_components/cda-page";
import { ReportWorkspace } from "../_components/report-workspace";
import { REPORT_PAGES } from "../_lib/labels";

/**
 * ATIR and ABR: two reports on one page, each with its own workflow. Both need
 * `cda:view_tax`, and apply only with a valid Certificate of Tax Exemption
 * (the server marks them not applicable otherwise).
 */
export default function Page() {
  const page = REPORT_PAGES.atir;
  return (
    <CdaPage
      title={page.title}
      description="The Annual Tax Incentives Report and the Annual Benefits Report, for a cooperative holding a valid Certificate of Tax Exemption."
      restriction={page.restriction}
    >
      {(ctx) =>
        ctx && (
          <div className="space-y-4">
            <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Both reports apply only while the cooperative holds a valid Certificate of Tax Exemption for the year. Set
              the CTE in CDA Settings.
            </p>
            <Tabs defaultValue="atir">
              <TabsList>
                <TabsTrigger value="atir">Annual Tax Incentives Report</TabsTrigger>
                <TabsTrigger value="abr">Annual Benefits Report</TabsTrigger>
              </TabsList>
              <TabsContent value="atir" className="pt-4">
                <ReportWorkspace key={`atir-${ctx.year}`} year={ctx.year} type="atir" />
              </TabsContent>
              <TabsContent value="abr" className="pt-4">
                <ReportWorkspace key={`abr-${ctx.year}`} year={ctx.year} type="abr" />
              </TabsContent>
            </Tabs>
          </div>
        )
      }
    </CdaPage>
  );
}
