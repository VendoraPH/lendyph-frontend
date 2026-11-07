"use client";

import { RouteGuard } from "@/components/common";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CdaPageHeader } from "../_components/cda-page-header";
import { DeadlineSettingsForm } from "./_components/deadline-settings-form";
import { ExtensionForm } from "./_components/extension-form";
import { ProfileForm } from "./_components/profile-form";
import { TemplatesPanel } from "./_components/templates-panel";

function CdaSettings() {
  return (
    <div className="space-y-6">
      <CdaPageHeader
        title="CDA Settings"
        description="The cooperative's regulatory profile, report templates and filing deadlines."
      />
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Regulatory profile</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="pt-4">
          <ProfileForm />
        </TabsContent>
        <TabsContent value="templates" className="pt-4">
          <TemplatesPanel />
        </TabsContent>
        <TabsContent value="deadlines" className="space-y-4 pt-4">
          <DeadlineSettingsForm />
          <ExtensionForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function Page() {
  return (
    <RouteGuard permission="cda:settings" pageName="CDA Settings">
      <CdaSettings />
    </RouteGuard>
  );
}
