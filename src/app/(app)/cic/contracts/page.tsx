"use client";

import { RecordsScreen } from "../_components/records-screen";
import { CicGuard } from "../_components/cic-guard";

export default function CicContractsPage() {
  return (
    <CicGuard permission="cic:view" pageName="Contract Records">
      <RecordsScreen kind="contracts" />
    </CicGuard>
  );
}
