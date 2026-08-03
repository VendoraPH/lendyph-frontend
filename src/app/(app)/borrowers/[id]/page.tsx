"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import type { Borrower, CoMaker, Loan, Payment } from "@/types";
import { borrowerService, loanService, coMakerService, repaymentService } from "@/services";
import type { CreateCoMakerData, UpdateCoMakerData } from "@/services/co-maker.service";
import { BorrowerHeader } from "./_components/borrower-header";
import { OverviewTab } from "./_components/overview-tab";
import { LoansTab } from "./_components/loans-tab";
import { PaymentsTab } from "./_components/payments-tab";
import { CoMakersTab } from "./_components/co-makers-tab";
import { DocumentsTab } from "./_components/documents-tab";
import { LedgerTab } from "./_components/ledger-tab";
import { ShareCapitalTab } from "./_components/share-capital-tab";
import { CollateralsTab } from "./_components/collaterals-tab";

export default function BorrowerDetailPage() {
  const params = useParams();
  const borrowerId = Number(params.id);

  const router = useRouter();
  const [borrower, setBorrower] = useState<Borrower | undefined>();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [coMakers, setCoMakers] = useState<CoMaker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCoMakers = useCallback(async () => {
    try {
      const res = await coMakerService.list(borrowerId);
      setCoMakers(Array.isArray(res) ? res : []);
    } catch {
      setCoMakers([]);
    }
  }, [borrowerId]);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [borrowerResult, loansResult] = await Promise.allSettled([
      borrowerService.detail(borrowerId),
      loanService.list({ borrower_id: borrowerId }),
    ]);

    if (borrowerResult.status === "fulfilled") {
      setBorrower(borrowerResult.value);
    } else {
      toast.error("We couldn't load the borrower details. Please try again.");
    }

    let loanList: Loan[] = [];
    if (loansResult.status === "fulfilled") {
      const loansRes = loansResult.value;
      // Loans may be paginated or a plain array
      if (Array.isArray(loansRes)) {
        loanList = loansRes;
      } else if (loansRes && typeof loansRes === "object" && "data" in loansRes) {
        loanList = (loansRes as { data: Loan[] }).data ?? [];
      }
      setLoans(loanList);
    } else {
      toast.error("We couldn't load the loans. Please try again.");
    }

    // Fetch repayments for all borrower loans
    if (loanList.length > 0) {
      try {
        const repaymentResults = await Promise.all(
          loanList.map((l: Loan) => repaymentService.list(l.id).catch(() => []))
        );
        const allPayments = repaymentResults.flatMap((res) =>
          Array.isArray(res) ? res : (res as unknown as { data: Payment[] })?.data ?? []
        );
        setPayments(allPayments);
      } catch {
        setPayments([]);
      }
    } else {
      setPayments([]);
    }

    await fetchCoMakers();

    setLoading(false);
  }, [borrowerId, fetchCoMakers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddCoMaker = async (data: CreateCoMakerData) => {
    try {
      await coMakerService.create(borrowerId, data);
      toast.success("Co-maker added");
      await fetchCoMakers();
    } catch {
      toast.error("We couldn't add the co-maker. Please try again.");
    }
  };

  const handleEditCoMaker = async (updated: CoMaker) => {
    try {
      await coMakerService.update(updated.id, updated as UpdateCoMakerData);
      toast.success("Co-maker updated");
      await fetchCoMakers();
    } catch {
      toast.error("We couldn't update the co-maker. Please try again.");
    }
  };

  const handleDeleteCoMaker = async (id: number) => {
    try {
      await coMakerService.delete(id);
      toast.success("Co-maker deleted");
      await fetchCoMakers();
    } catch {
      toast.error("We couldn't delete the co-maker. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (!borrower) {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
        <p className="text-muted-foreground">Borrower not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BorrowerHeader
        borrower={borrower}
        onEdit={() => router.push(`/borrowers/${borrowerId}/edit`)}
        onPhotoUpdate={fetchData}
      />

      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="loans">Loans ({loans.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
          <TabsTrigger value="co-makers">Co-Makers ({coMakers.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents &amp; IDs</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="share-capital">Share Capital</TabsTrigger>
          <TabsTrigger value="collaterals">Collaterals</TabsTrigger>
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
            onAdd={handleAddCoMaker}
            onEdit={handleEditCoMaker}
            onDelete={handleDeleteCoMaker}
          />
        </TabsContent>

        <TabsContent value="documents" className="pt-4">
          <DocumentsTab borrowerId={borrower.id} />
        </TabsContent>

        <TabsContent value="ledger" className="pt-4">
          <LedgerTab borrowerId={borrower.id} />
        </TabsContent>

        <TabsContent value="share-capital" className="pt-4">
          <ShareCapitalTab borrowerId={borrower.id} />
        </TabsContent>

        <TabsContent value="collaterals" className="pt-4">
          <CollateralsTab borrowerId={borrower.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
