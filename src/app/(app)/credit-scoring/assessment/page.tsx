"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/common/route-guard";
import { MemberSearchPicker } from "@/components/common/member-search-picker";
import { CreditScoringPageHeader } from "../_components/page-header";
import { CreditAssessmentPanel } from "./_components/credit-assessment-panel";
import { Label } from "@/components/ui/label";
import { usePermission } from "@/hooks";
import type { MemberOption } from "@/hooks/use-member-search";

function CreditAssessmentContent() {
  const [member, setMember] = useState<MemberOption | null>(null);
  // The member list needs `borrowers:view`; without it the picker is locked
  // rather than asking and being refused.
  const canListMembers = usePermission().can("borrowers:view");

  return (
    <div className="space-y-6">
      <CreditScoringPageHeader
        title="Credit Assessment"
        description="Run a fresh credit assessment for any borrower."
      />

      <div className="max-w-sm space-y-1.5">
        <Label>Borrower</Label>
        <MemberSearchPicker
          value={member}
          onChange={setMember}
          canSearch={canListMembers}
          placeholder="Select a borrower"
          aria-label="Borrower"
        />
      </div>

      {member && <CreditAssessmentPanel borrowerId={member.id} />}
    </div>
  );
}

export default function CreditAssessmentPage() {
  return (
    <RouteGuard permission="credit_scoring:view" pageName="Credit Assessment">
      <CreditAssessmentContent />
    </RouteGuard>
  );
}
