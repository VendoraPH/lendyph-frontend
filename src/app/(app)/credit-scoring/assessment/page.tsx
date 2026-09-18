"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RouteGuard } from "@/components/common/route-guard";
import { CreditScoringPageHeader } from "../_components/page-header";
import { CreditAssessmentPanel } from "./_components/credit-assessment-panel";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { borrowerService } from "@/services";
import type { Borrower } from "@/types";

export default function CreditAssessmentPage() {
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [borrowerId, setBorrowerId] = useState<string>("");
  // Set only when the borrower drain gave up with pages outstanding, i.e. the
  // picker below is knowingly missing people. Null means complete.
  const [borrowerShortfall, setBorrowerShortfall] = useState<{
    shown: number;
    total: number | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    borrowerService
      .listAll()
      .then((drain) => {
        if (cancelled) return;
        setBorrowers(drain.rows);
        setBorrowerShortfall(
          drain.truncated ? { shown: drain.rows.length, total: drain.total } : null,
        );
      })
      .catch(() => {
        if (!cancelled) toast.error("We couldn't load borrowers. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = useCallback((v: string | null) => setBorrowerId(v ?? ""), []);

  return (
    <RouteGuard permission="credit_scoring:view" pageName="Credit Assessment">
      <div className="space-y-6">
        <CreditScoringPageHeader
          title="Credit Assessment"
          description="Run a fresh credit assessment for any borrower."
        />

        {borrowerShortfall && (
          <IncompleteListNotice
            shown={borrowerShortfall.shown}
            total={borrowerShortfall.total}
            noun="borrowers"
            consequence="Some borrowers are missing from the picker below and cannot be selected."
          />
        )}

        <div className="max-w-sm space-y-1.5">
          <Label>Borrower</Label>
          <Select
            value={borrowerId}
            onValueChange={handleSelect}
            items={borrowers.map((b) => ({ value: String(b.id), label: b.full_name }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a borrower" />
            </SelectTrigger>
            <SelectContent>
              {borrowers.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {borrowerId && <CreditAssessmentPanel borrowerId={Number(borrowerId)} />}
      </div>
    </RouteGuard>
  );
}
