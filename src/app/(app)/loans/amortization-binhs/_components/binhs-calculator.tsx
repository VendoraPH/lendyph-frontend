"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RouteGuard } from "@/components/common";
import { loanService } from "@/services";
import { formatDateISO } from "@/lib/format";
import type { BinhsInput } from "@/lib/binhs";
import { BinhsInputForm } from "./binhs-input-form";
import { BinhsIdealTab } from "./binhs-ideal-tab";
import { BinhsWorstCaseTab } from "./binhs-worst-case-tab";
import { BinhsCustomTab } from "./binhs-custom-tab";

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return formatDateISO(d);
}

const DEFAULT_INPUT: BinhsInput = {
  principal: 10000,
  annualInterestRate: 24,
  termMonths: 6,
  scbuPerPeriod: 100,
  startDate: defaultStartDate(),
};

function BinhsPageContent() {
  const params = useSearchParams();
  const loanId = params.get("loan_id");
  const [input, setInput] = useState<BinhsInput>(DEFAULT_INPUT);
  const prefilledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!loanId || prefilledRef.current === loanId) return;
    let cancelled = false;
    (async () => {
      try {
        const loan = await loanService.detail(Number(loanId));
        if (cancelled) return;
        const next: BinhsInput = {
          principal: Number(loan.principal_amount) || DEFAULT_INPUT.principal,
          annualInterestRate:
            Number(loan.interest_rate) || DEFAULT_INPUT.annualInterestRate,
          termMonths:
            Number(loan.term) || DEFAULT_INPUT.termMonths,
          scbuPerPeriod: DEFAULT_INPUT.scbuPerPeriod,
          startDate: loan.start_date || DEFAULT_INPUT.startDate,
        };
        setInput(next);
        prefilledRef.current = loanId;
      } catch {
        toast.error("Could not load loan for prefill.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loanId]);

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Amortization (BINHS)</CardTitle>
          <CardDescription>
            BINHS computation compounds penalty and prior unpaid principal when
            a due is left unpaid for more than 30 days. Penalty is 20% of the
            cumulative unpaid principal; interest and penalty are added to the
            outstanding balance. Switch tabs to view the Ideal schedule,
            Worst Case (no dues paid), or Custom (toggle which dues are paid).
          </CardDescription>
        </CardHeader>
      </Card>

      <BinhsInputForm value={input} onChange={setInput} />

      <Tabs defaultValue="ideal" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ideal">Ideal</TabsTrigger>
          <TabsTrigger value="worst">Worst Case</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>
        <TabsContent value="ideal">
          <BinhsIdealTab input={input} />
        </TabsContent>
        <TabsContent value="worst">
          <BinhsWorstCaseTab input={input} />
        </TabsContent>
        <TabsContent value="custom">
          <BinhsCustomTab input={input} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function BinhsCalculator() {
  return (
    <RouteGuard permission="loans:view" pageName="Amortization BINHS">
      <Suspense
        fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}
      >
        <BinhsPageContent />
      </Suspense>
    </RouteGuard>
  );
}
