"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { ScrollBox } from "@/components/common/page-fill";
import { RouteGuard } from "@/components/common/route-guard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiResource } from "@/hooks";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { loanOriginationService } from "@/services";
import type { OriginationSettings } from "@/types/loan-origination";
import { AssessmentSection } from "./_components/assessment-section";
import { DocumentsSection, toKey } from "./_components/documents-section";
import { GeneralSection, NotificationsSection } from "./_components/general-section";
import { ProductsSection } from "./_components/products-section";

/** What the server would refuse anyway, caught before the round trip. */
function problems(s: OriginationSettings): string[] {
  const out: string[] = [];
  if (!s.general.reference_format.trim()) out.push("Enter a reference format.");
  if (s.general.draft_expiration_days < 1) out.push("Drafts must be kept at least one day.");
  if (s.assessment.max_dti <= 0) out.push("The highest debt-to-income must be above zero.");
  if (s.documents.accepted_file_types.length === 0) out.push("Accept at least one file type.");
  if (s.documents.types.some((t) => !t.label.trim())) out.push("Name every document type, or remove the empty ones.");
  return out;
}

function SettingsForm({ initial }: { initial: OriginationSettings }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("general");
  const set = <K extends keyof OriginationSettings>(key: K) => (value: OriginationSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    const found = problems(form);
    if (found.length) {
      notifyValidation(found);
      return;
    }
    const payload: OriginationSettings = {
      ...form,
      documents: { ...form.documents, types: form.documents.types.map((t) => ({ ...t, type: t.type || toKey(t.label) })) },
    };
    setSaving(true);
    loanOriginationService
      .updateSettings(payload)
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
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Save settings
          </Button>
        </div>
        <TabsContent value="general">
          <GeneralSection value={form.general} onChange={set("general")} />
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
