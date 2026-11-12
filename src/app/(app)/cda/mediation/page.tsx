"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CdaPage } from "../_components/cda-page";
import { ReportWorkspace } from "../_components/report-workspace";
import { PART_LABELS, REPORT_PAGES } from "../_lib/labels";
import { linkedPart, withoutParams } from "../_lib/link-params";
import { MediationCases } from "./_components/cases";

/**
 * The half shown: a link's `&part=` (a notice about the second half opens
 * it), until a tab is picked by hand, which drops `part` from the address.
 * Rendered inside the CDA page frame's Suspense boundary.
 */
function useMediationTab(): [string, (tab: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [picked, setPicked] = useState<string | null>(null);
  const tab = picked ?? linkedPart(searchParams.get("part")) ?? "h1";

  function pick(next: string) {
    setPicked(next);
    if (searchParams.has("part")) router.replace(withoutParams(pathname, searchParams.toString(), ["part"]));
  }

  return [tab, pick];
}

function MediationReports({ year, version }: { year: number; version: number }) {
  const [tab, setTab] = useMediationTab();
  return (
    <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
      <TabsList>
        <TabsTrigger value="h1">{PART_LABELS.h1}</TabsTrigger>
        <TabsTrigger value="h2">{PART_LABELS.h2}</TabsTrigger>
      </TabsList>
      <TabsContent value="h1" className="pt-4">
        <ReportWorkspace key={`h1-${year}-${version}`} year={year} type="mediation" part="h1" />
      </TabsContent>
      <TabsContent value="h2" className="pt-4">
        <ReportWorkspace key={`h2-${year}-${version}`} year={year} type="mediation" part="h2" />
      </TabsContent>
    </Tabs>
  );
}

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
            <MediationReports year={ctx.year} version={version} />
          </div>
        )
      }
    </CdaPage>
  );
}
