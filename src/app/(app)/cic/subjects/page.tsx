"use client";

import { RecordsScreen } from "../_components/records-screen";
import { CicGuard } from "../_components/cic-guard";

export default function CicSubjectsPage() {
  return (
    <CicGuard permission="cic:view" pageName="Subject Records">
      <RecordsScreen kind="subjects" />
    </CicGuard>
  );
}
