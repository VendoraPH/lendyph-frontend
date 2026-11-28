"use client";

import { useState } from "react";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { useApiResource } from "@/hooks";
import { cicService } from "@/services";
import type { CicSettings } from "@/types/cic";
import { CicPageHeader } from "../../cic/_components/page-header";
import { GeneralSettingsCard } from "./_components/general-settings-card";
import { ProductMappingCard } from "./_components/product-mapping-card";
import { PublicKeyCard } from "./_components/public-key-card";
import { CicGuard } from "@/app/(app)/cic/_components/cic-guard";

function CicSettingsContent() {
  const settings = useApiResource(cicService.getSettings);
  const mappings = useApiResource(cicService.getProductMappings);
  // A save returns the new settings; show them without reloading the page.
  const [saved, setSaved] = useState<CicSettings | null>(null);

  return (
    <PageFill>
      <CicPageHeader
        title="CIC Settings"
        description="The provider code, encryption key and loan product mapping the CIC report is built with."
      />
      <ScrollBox className="space-y-6 p-px">
        <DataState resource={settings} summary="The CIC provider code, MFI status and CIC's public key." endpoints={["GET /cic/settings"]}>
          {(loaded) => {
            const current = saved ?? loaded;
            return (
              <>
                <GeneralSettingsCard settings={current} onSaved={setSaved} />
                <PublicKeyCard settings={current} onChange={setSaved} />
              </>
            );
          }}
        </DataState>
        <DataState
          resource={mappings}
          summary="Which CIC contract record and type each loan product is reported as."
          endpoints={["GET /cic/product-mappings"]}
        >
          {(rows) => <ProductMappingCard mappings={rows} />}
        </DataState>
      </ScrollBox>
    </PageFill>
  );
}

export default function CicSettingsPage() {
  return (
    <CicGuard permission="cic:settings" pageName="CIC Settings">
      <CicSettingsContent />
    </CicGuard>
  );
}
