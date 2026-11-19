"use client";

import { useState } from "react";
import { FillSection, PageFill, ScrollBox } from "@/components/common/page-fill";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermission } from "@/hooks";
import { amlaSettingsSections } from "@/lib/amla/access";
import { AmlaCalendarTab } from "./amla-calendar-tab";
import { AmlaChangeRequestsTab } from "./amla-change-requests-tab";
import { AmlaLogTab } from "./amla-log-tab";
import { AmlaOverviewTab } from "./amla-overview-tab";
import { AmlaVersionsTab } from "./amla-versions-tab";

/**
 * Settings → AMLA. Each tab shows only when the user holds what its endpoints
 * need (`amlaSettingsSections`), so no tab loads data the server would refuse.
 * Tabs mount when opened: the AMLA log is read, and that read logged, only
 * when its tab is opened.
 */
export function AmlaSettingsScreen() {
  const { can } = usePermission();
  const sections = amlaSettingsSections(can);
  const tabs = [
    { value: "overview", label: "Overview", shown: sections.status || sections.settings },
    { value: "requests", label: "Change requests", shown: sections.changeRequests },
    { value: "history", label: "History", shown: sections.versions },
    { value: "calendar", label: "Calendar and deadlines", shown: sections.calendar },
    { value: "log", label: "AMLA log", shown: sections.log },
  ].filter((tab) => tab.shown);
  const [picked, setPicked] = useState<string | null>(null);
  const tab = tabs.some((t) => t.value === picked) ? picked : (tabs[0]?.value ?? null);

  return (
    <PageFill>
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">AMLA</h1>
        <p className="text-sm text-muted-foreground">
          Anti-money laundering settings, the working-day calendar for report deadlines, and AMLA&apos;s own log. Every
          change waits for a second AMLA settings holder to approve it, and every value stays &quot;to verify&quot; until
          what confirmed it is recorded.
        </p>
      </div>

      {tab === null ? (
        <Card className="shrink-0">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            AMLA covers the whole cooperative, so these settings need access to every branch.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setPicked(String(v))} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="max-w-full shrink-0 justify-start overflow-x-auto">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="overview" className="min-h-0 flex-1">
            <ScrollBox className="h-full space-y-4 p-px">
              <AmlaOverviewTab sections={sections} />
            </ScrollBox>
          </TabsContent>
          <TabsContent value="requests" className="min-h-0 flex-1">
            <FillSection className="h-full">
              <AmlaChangeRequestsTab />
            </FillSection>
          </TabsContent>
          <TabsContent value="history" className="min-h-0 flex-1">
            <ScrollBox className="h-full space-y-4 p-px">
              <AmlaVersionsTab />
            </ScrollBox>
          </TabsContent>
          <TabsContent value="calendar" className="min-h-0 flex-1">
            <ScrollBox className="h-full space-y-4 p-px">
              <AmlaCalendarTab canAsk={sections.calendarRequests} />
            </ScrollBox>
          </TabsContent>
          <TabsContent value="log" className="min-h-0 flex-1">
            <FillSection className="h-full">
              <AmlaLogTab />
            </FillSection>
          </TabsContent>
        </Tabs>
      )}
    </PageFill>
  );
}
