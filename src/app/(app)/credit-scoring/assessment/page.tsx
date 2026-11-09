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
        description="See a member's current credit score, worked out every night and when their records change."
      />

      <p className="max-w-2xl rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        To assess a loan application, open the loan while it is a draft or for approval. Its Credit Assessment card
        takes the application&apos;s details and scores that application.
      </p>

      <div className="max-w-sm space-y-1.5">
        <Label>Member</Label>
        <MemberSearchPicker
          value={member}
          onChange={setMember}
          canSearch={canListMembers}
          placeholder="Select a member"
          aria-label="Member"
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
