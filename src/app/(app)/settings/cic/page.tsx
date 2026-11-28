"use client";

import { useState } from "react";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { useApiResource } from "@/hooks";
import { cicService } from "@/services";
import type { CicSettings } from "@/types/cic";
import { CicPageHeader } from "../../cic/_components/page-header";
import { CodeMappingCard } from "./_components/code-mapping-card";
import { GeneralSettingsCard } from "./_components/general-settings-card";
import { LoanOverrideCard } from "./_components/loan-override-card";
import { ProductMappingCard } from "./_components/product-mapping-card";
import { PublicKeyCard } from "./_components/public-key-card";
import { CicGuard } from "@/app/(app)/cic/_components/cic-guard";

function CicSettingsContent() {
  const settings = useApiResource(cicService.getSettings);
  const products = useApiResource(cicService.getProductMappings);
  const codes = useApiResource(cicService.getCodeMappings);
  // A save answers with the new settings; show them without reloading the page.
  const [saved, setSaved] = useState<CicSettings | null>(null);

  return (
    <PageFill>
      <CicPageHeader
        title="CIC"
        description="The provider code, CIC's encryption key, and how loan products, loans, collateral and IDs are reported."
      />
      <ScrollBox className="space-y-6 p-px">
        <DataState resource={settings} summary="The CIC provider code, MFI status and contact." endpoints={["GET /cic/settings"]}>
          {(loaded) => <GeneralSettingsCard key={(saved ?? loaded).updated_at ?? "new"} settings={saved ?? loaded} onSaved={setSaved} />}
        </DataState>
        <PublicKeyCard />
        <DataState
          resource={products}
          summary="Which CIC record and codes each loan product is reported with."
          endpoints={["GET /cic/product-mappings"]}
        >
          {(m) => (
            <>
              <ProductMappingCard initial={m} />
              <LoanOverrideCard codeLists={m.code_lists} />
            </>
          )}
        </DataState>
        <DataState
          resource={codes}
          summary="The CIC code each collateral type and ID kind is reported as."
          endpoints={["GET /cic/code-mappings"]}
        >
          {(m) => <CodeMappingCard initial={m} />}
        </DataState>
      </ScrollBox>
    </PageFill>
  );
}

export default function CicSettingsPage() {
  return (
    <CicGuard permission="cic:settings" pageName="CIC">
      <CicSettingsContent />
    </CicGuard>
  );
}
