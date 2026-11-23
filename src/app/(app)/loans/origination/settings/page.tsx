"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { ScrollBox } from "@/components/common/page-fill";
import { RouteGuard } from "@/components/common/route-guard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiResource, usePermission } from "@/hooks";
import { settingsSaveBlocker } from "@/lib/loan-origination";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/notify";
import { loanOriginationService } from "@/services";
import type { OriginationSettings } from "@/types/loan-origination";
import { settingsPayload, settingsProblems } from "../_lib/settings-form";
import { AssessmentSection } from "./_components/assessment-section";
import { DocumentsSection } from "./_components/documents-section";
import { GeneralSection, NotificationsSection, ServerSection } from "./_components/general-section";
import { ProductsSection } from "./_components/products-section";

function SettingsForm({ initial }: { initial: OriginationSettings }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("general");
  const blocker = settingsSaveBlocker(usePermission().can("branches:view_all"));
  const set = <K extends keyof OriginationSettings>(key: K) => (value: OriginationSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // The server checks every limit and refuses in its own words; only a
  // document type with no name (and so no key) is caught here.
  const save = () => {
    const found = settingsProblems(form);
    if (found.length) {
      notifyWarning(found[0]);
      return;
    }
    setSaving(true);
    loanOriginationService
      .updateSettings(settingsPayload(form))
      .then((saved) => {
        setForm(saved);
        notifySuccess("Settings saved");
      })
      .catch((err) => notifyError(err, "Could not save the settings"))
      .then(() => setSaving(false));
  };

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList className="max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="assessment">Assessment</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="notifications">Messages</TabsTrigger>
          </TabsList>
          <Button size="sm" onClick={save} disabled={saving || blocker !== null} title={blocker ?? undefined}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Save settings
          </Button>
        </div>
        {blocker && <p className="text-xs text-muted-foreground">{blocker}</p>}
        <TabsContent value="general" className="space-y-4">
          <GeneralSection value={form.general} onChange={set("general")} />
          <ServerSection server={form.server} rulesVersion={form.rules_version} updatedBy={form.updated_by} updatedAt={form.updated_at} />
        </TabsContent>
        <TabsContent value="products">
          <ProductsSection value={form.products} documentTypes={form.documents.types} onChange={set("products")} />
        </TabsContent>
        <TabsContent value="assessment" className="space-y-4">
          <AssessmentSection value={form.assessment} onChange={set("assessment")} />
        </TabsContent>
        <TabsContent value="documents" className="space-y-4">
          <DocumentsSection value={form.documents} onChange={set("documents")} />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationsSection value={form.notifications} onChange={set("notifications")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SettingsLoader() {
  const resource = useApiResource(loanOriginationService.getSettings);
  return (
    <DataState
      resource={resource}
      summary="Online application, affordability and document rules will be set here once online applications are connected."
      endpoints={["GET /loan-origination/settings", "PUT /loan-origination/settings"]}
    >
      {(data) => <SettingsForm initial={data} />}
    </DataState>
  );
}

export default function OriginationSettingsPage() {
  return (
    <RouteGuard permission="loan_origination:settings" pageName="Loan Origination settings">
      <ScrollBox>
        <SettingsLoader />
      </ScrollBox>
    </RouteGuard>
  );
}
