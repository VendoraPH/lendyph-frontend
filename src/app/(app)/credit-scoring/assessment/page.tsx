"use client";

import { useCallback, useEffect, useState } from "react";
import { RouteGuard } from "@/components/common/route-guard";
import { CreditScoringPageHeader } from "../_components/page-header";
import { CreditAssessmentPanel } from "./_components/credit-assessment-panel";
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

  useEffect(() => {
    let cancelled = false;
    borrowerService
      .list({ per_page: 100 })
      .then((res) => {
        if (!cancelled) setBorrowers(res.data);
      })
      .catch(() => {
        if (!cancelled) setBorrowers([]);
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

        <div className="max-w-sm space-y-1.5">
          <Label>Borrower</Label>
          <Select value={borrowerId} onValueChange={handleSelect}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a borrower" />
            </SelectTrigger>
            <SelectContent>
              {borrowers.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.first_name} {b.last_name}
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
