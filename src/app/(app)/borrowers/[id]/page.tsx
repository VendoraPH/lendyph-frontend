"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import type { Borrower, CoMaker, Loan, Payment } from "@/types";
import { borrowerService, loanService, coMakerService, repaymentService } from "@/services";
import type { CreateCoMakerData, UpdateCoMakerData } from "@/services/co-maker.service";
import { EditBorrowerDialog } from "../_components/borrower-actions";
import { BorrowerHeader } from "./_components/borrower-header";
import { OverviewTab } from "./_components/overview-tab";
import { LoansTab } from "./_components/loans-tab";
import { PaymentsTab } from "./_components/payments-tab";
import { CoMakersTab } from "./_components/co-makers-tab";
import { DocumentsTab } from "./_components/documents-tab";
import { LedgerTab } from "./_components/ledger-tab";

export default function BorrowerDetailPage() {
  const params = useParams();
  const borrowerId = Number(params.id);

  const [borrower, setBorrower] = useState<Borrower | undefined>();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [coMakers, setCoMakers] = useState<CoMaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

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
      toast.error("Failed to load borrower details");
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
      toast.error("Failed to load loans");
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
      toast.success("Co-maker added successfully");
      await fetchCoMakers();
    } catch {
      toast.error("Failed to add co-maker");
    }
  };

  const handleEditCoMaker = async (updated: CoMaker) => {
    try {
      await coMakerService.update(updated.id, updated as UpdateCoMakerData);
      toast.success("Co-maker updated successfully");
      await fetchCoMakers();
    } catch {
      toast.error("Failed to update co-maker");
    }
  };

  const handleDeleteCoMaker = async (id: number) => {
    try {
      await coMakerService.delete(id);
      toast.success("Co-maker deleted successfully");
      await fetchCoMakers();
    } catch {
      toast.error("Failed to delete co-maker");
    }
  };

  const handleEditBorrower = async (updated: Borrower) => {
    try {
      // Build payload with only the fields the API accepts
      const payload: Record<string, unknown> = {
        first_name: updated.first_name,
        last_name: updated.last_name,
        middle_name: updated.middle_name ?? null,
        suffix: updated.suffix ?? null,
        birthdate: updated.birthdate ?? null,
        gender: updated.gender ?? null,
        civil_status: updated.civil_status ?? null,
        contact_number: updated.contact_number ?? updated.phone ?? null,
        email: updated.email ?? null,
        address: updated.address ?? null,
        employer_or_business: updated.employer_or_business ?? null,
        monthly_income: updated.monthly_income ? Number(updated.monthly_income) : null,
      };
      await borrowerService.update(borrowerId, payload as Partial<Borrower>);
      toast.success("Borrower updated successfully");
      // Refresh data
      const refreshed = await borrowerService.detail(borrowerId);
      setBorrower(refreshed);
      setEditOpen(false);
    } catch {
      toast.error("Failed to update borrower");
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
        onEdit={() => setEditOpen(true)}
        onPhotoUpdate={fetchData}
      />

      <EditBorrowerDialog
        borrower={borrower}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleEditBorrower}
      />

      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="loans">Loans ({loans.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
          <TabsTrigger value="co-makers">Co-Makers ({coMakers.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
