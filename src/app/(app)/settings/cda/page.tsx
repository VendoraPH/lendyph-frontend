"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermission } from "@/hooks";
import { FIT_CLASSES } from "@/lib/page-fill";
import { cn } from "@/lib/utils";
import { CdaPage } from "@/app/(app)/cda/_components/cda-page";
import { DeadlineSettingsForm } from "./_components/deadline-settings-form";
import { ExtensionForm } from "./_components/extension-form";
import { ProfileForm } from "./_components/profile-form";
import { TemplatesPanel } from "./_components/templates-panel";

/**
 * CDA settings. Reading them needs cda:view (and every branch); changing them
 * needs cda:settings, and without it every input is read only. The template
 * manager is for the super_admin role only, as the server checks. The open tab
 * is kept here, above the period reload a saved extension causes, so saving
 * never moves the user to another tab.
 */
export default function Page() {
  const { can, isRole } = usePermission();
  const templateManager = isRole("super_admin");
  const [tab, setTab] = useState("profile");
  return (
    <CdaPage
      title="CDA"
      description="The cooperative's regulatory profile, deadlines, reminders and report templates."
      yearless
    >
      {(ctx) => (
        <Tabs value={tab} onValueChange={(next) => setTab(String(next))} className={FIT_CLASSES.section}>
          {!can("cda:settings") && (
            <p className="mb-3 shrink-0 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              You can read these settings. Changing them needs the CDA Compliance: Configure CDA settings permission.
            </p>
          )}
          <TabsList className="shrink-0">
            <TabsTrigger value="profile">Regulatory profile</TabsTrigger>
            <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
            {templateManager && <TabsTrigger value="templates">Templates</TabsTrigger>}
          </TabsList>
          <TabsContent value="profile" className={cn(FIT_CLASSES.section, "pt-4")}>
            <ProfileForm />
          </TabsContent>
          {/* From xl the year's extension sits beside the settings form, which keeps the page's height. */}
          <TabsContent
            value="deadlines"
            className={cn(
              FIT_CLASSES.section,
              "gap-4 pt-4",
              ctx && "xl:grid xl:grid-cols-[minmax(0,1fr)_24rem] xl:grid-rows-[minmax(0,1fr)]",
            )}
          >
            <DeadlineSettingsForm />
            {ctx && <ExtensionForm key={ctx.year} period={ctx.period} onSaved={ctx.reloadPeriods} />}
          </TabsContent>
          {templateManager && (
            <TabsContent value="templates" className={cn(FIT_CLASSES.section, "pt-4")}>
              <TemplatesPanel />
            </TabsContent>
          )}
        </Tabs>
      )}
    </CdaPage>
  );
}
