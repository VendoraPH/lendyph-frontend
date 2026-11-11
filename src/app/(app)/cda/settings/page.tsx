"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermission } from "@/hooks";
import { CdaPage } from "../_components/cda-page";
import { DeadlineSettingsForm } from "./_components/deadline-settings-form";
import { ExtensionForm } from "./_components/extension-form";
import { ProfileForm } from "./_components/profile-form";
import { TemplatesPanel } from "./_components/templates-panel";

/**
 * CDA settings. Reading them needs cda:view (and every branch); saving needs
 * cda:settings. The template manager is for the super_admin role only, as the
 * server checks.
 */
export default function Page() {
  const { isRole } = usePermission();
  const templateManager = isRole("super_admin");
  return (
    <CdaPage
      title="CDA Settings"
      description="The cooperative's regulatory profile, deadlines, reminders and report templates."
      yearless
    >
      {(ctx) => (
        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Regulatory profile</TabsTrigger>
            <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
            {templateManager && <TabsTrigger value="templates">Templates</TabsTrigger>}
          </TabsList>
          <TabsContent value="profile" className="pt-4">
            <ProfileForm />
          </TabsContent>
          <TabsContent value="deadlines" className="space-y-4 pt-4">
            <DeadlineSettingsForm />
            {ctx && <ExtensionForm key={ctx.year} period={ctx.period} onSaved={ctx.reloadPeriods} />}
          </TabsContent>
          {templateManager && (
            <TabsContent value="templates" className="pt-4">
              <TemplatesPanel />
            </TabsContent>
          )}
        </Tabs>
      )}
    </CdaPage>
  );
}
