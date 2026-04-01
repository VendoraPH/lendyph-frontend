"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Borrower, CoMaker, Loan, Payment } from "@/types";
import { borrowerService } from "@/services";
import { toast } from "sonner";
import { BorrowerHeader } from "./_components/borrower-header";
import { OverviewTab } from "./_components/overview-tab";
import { LoansTab } from "./_components/loans-tab";
import { PaymentsTab } from "./_components/payments-tab";
import { CoMakersTab } from "./_components/co-makers-tab";

export default function BorrowerDetailPage() {
  const params = useParams();
  const borrowerId = Number(params.id);

  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [coMakers, setCoMakers] = useState<CoMaker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const borrowerData = await borrowerService.detail(borrowerId);
      setBorrower(borrowerData);

      // Fetch related data — these may fail if endpoints aren't ready
      try {
        const loansData = await borrowerService.loans(borrowerId);
        setLoans(Array.isArray(loansData) ? loansData : []);
      } catch {
        setLoans([]);
      }

      try {
        const paymentsData = await borrowerService.payments(borrowerId);
        setPayments(Array.isArray(paymentsData) ? paymentsData : []);
      } catch {
        setPayments([]);
      }

      try {
        const coMakersData = await borrowerService.coMakers(borrowerId);
        setCoMakers(Array.isArray(coMakersData) ? coMakersData : []);
      } catch {
        setCoMakers([]);
      }
    } catch {
      toast.error("Failed to load borrower details");
    } finally {
      setLoading(false);
    }
  }, [borrowerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-orange border-t-transparent" />
      </div>
    );
  }

  if (!borrower) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Borrower not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BorrowerHeader
        borrower={borrower}
        onEdit={() => {}}
      />

      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="loans">Loans ({loans.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
          <TabsTrigger value="co-makers">Co-Makers ({coMakers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <OverviewTab borrower={borrower} loans={loans} coMakers={coMakers} />
        </TabsContent>

        <TabsContent value="loans" className="pt-4">
          <LoansTab loans={loans} coMakers={coMakers} />
        </TabsContent>

        <TabsContent value="payments" className="pt-4">
          <PaymentsTab payments={payments} loans={loans} />
        </TabsContent>

        <TabsContent value="co-makers" className="pt-4">
          <CoMakersTab
            coMakers={coMakers}
            loans={loans}
            borrowerId={borrower.id}
            onAdd={() => fetchData()}
            onEdit={() => fetchData()}
            onDelete={() => fetchData()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
