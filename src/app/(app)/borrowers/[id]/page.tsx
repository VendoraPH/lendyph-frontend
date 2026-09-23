"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { PrintableMenu } from "@/components/common";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { toast } from "sonner";
import type { Borrower, CoMaker, Loan, Payment } from "@/types";
import { borrowerService, loanService, coMakerService, repaymentService } from "@/services";
import type { CreateCoMakerData, UpdateCoMakerData } from "@/services/co-maker.service";
import { notifyError } from "@/lib/notify";
import { toBorrowerPayments, type RepaymentListShortfall } from "@/lib/repayment-list";
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
  // Each set only when its drain gave up with pages outstanding, i.e. that
  // list is knowingly short. Null means complete.
  const [loanShortfall, setLoanShortfall] = useState<{
    shown: number;
    total: number | null;
  } | null>(null);
  const [paymentShortfall, setPaymentShortfall] = useState<RepaymentListShortfall | null>(null);
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

    const [borrowerResult, loansResult, paymentsResult] = await Promise.allSettled([
      borrowerService.detail(borrowerId),
      // Drained across pages. This was `loanService.list({ borrower_id })` —
      // one default page of 15 — so a member past their fifteenth loan had the
      // rest missing from the Loans tab, the Overview and every balance built
      // on them, and missing from the Payments tab too, which was read loan by
      // loan off that same list.
      loanService.listAll({ borrower_id: borrowerId }),
      // One drain over everything the member paid, across all their loans. This
      // was one `repaymentService.list(loanId)` per loan, each the endpoint's
      // default page of 15 and the OLDEST 15, so the tab lost every loan's
      // newest payments and counted what was left. Draining per loan would fix
      // the count but cost a request per loan against a shared 60-a-minute
      // budget, and a member who renews a one-month loan every month holds
      // dozens of them.
      repaymentService.listAll({ borrower_id: borrowerId }),
    ]);

    if (borrowerResult.status === "fulfilled") {
      setBorrower(borrowerResult.value);
    } else {
      toast.error("We couldn't load the borrower details. Please try again.");
    }

    if (loansResult.status === "fulfilled") {
      const loanDrain = loansResult.value;
      setLoans(loanDrain.rows);
      setLoanShortfall(
        loanDrain.truncated
          ? { shown: loanDrain.rows.length, total: loanDrain.total }
          : null,
      );
    } else {
      toast.error("We couldn't load the loans. Please try again.");
    }

    if (paymentsResult.status === "fulfilled") {
      const { payments, shortfall } = toBorrowerPayments(paymentsResult.value);
      setPayments(payments);
      setPaymentShortfall(shortfall);
    } else {
      // Said out loud: an empty tab reads as "this member has paid nothing".
      setPayments([]);
      setPaymentShortfall(null);
      toast.error("We couldn't load the payments. Please try again.");
    }

    await fetchCoMakers();

    setLoading(false);
  }, [borrowerId, fetchCoMakers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Errors go through notifyError so a field-level 422 — a contact number over
  // the API's 20 characters, say — names the field instead of reading as a
  // generic "please try again".
  const handleAddCoMaker = async (data: CreateCoMakerData) => {
    try {
      await coMakerService.create(borrowerId, data);
      toast.success("Co-maker added");
      await fetchCoMakers();
    } catch (err) {
      notifyError(err, "We couldn't add the co-maker. Please try again.");
    }
  };

  const handleEditCoMaker = async (id: number, data: UpdateCoMakerData) => {
    try {
      await coMakerService.update(id, data);
      toast.success("Co-maker updated");
      await fetchCoMakers();
    } catch (err) {
      notifyError(err, "We couldn't update the co-maker. Please try again.");
    }
  };

  const handleDeleteCoMaker = async (id: number) => {
    try {
      await coMakerService.delete(id);
      toast.success("Co-maker deleted");
      await fetchCoMakers();
    } catch (err) {
      notifyError(err, "We couldn't delete the co-maker. Please try again.");
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

      {/* Member documents — the same catalog `/printables` serves, opened for
          the member already on screen instead of re-picking them there. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Open a member document on your cooperative&apos;s letterhead, ready to
          print.
        </p>
        <PrintableMenu
          subjectId={borrower.id}
          size="sm"
          ids={["member_ledger_card", "share_capital_certificate"]}
        />
      </div>

      {loanShortfall && (
        <IncompleteListNotice
          shown={loanShortfall.shown}
          total={loanShortfall.total}
          noun="loans"
          consequence="The Loans tab, the Overview and the balances on the Payments tab cover only the loans that loaded."
        />
      )}

      {paymentShortfall && (
        <IncompleteListNotice
          shown={paymentShortfall.shown}
          total={paymentShortfall.total}
          noun="payments"
          consequence="The Payments tab's count and Total Paid cover only the payments that loaded."
        />
      )}

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
