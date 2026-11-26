"use client";

import { useMenuVisibility } from "@/hooks/use-menu-visibility";
import { memberPageParts } from "@/lib/hidden-module-parts";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrintableMenu, RouteGuard } from "@/components/common";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { PageFill, PageLoader, ScrollBox } from "@/components/common/page-fill";
import { FIT_CLASSES } from "@/lib/page-fill";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Borrower, CoMaker, Loan, Payment, Repayment } from "@/types";
import { borrowerService, loanService, coMakerService, repaymentService } from "@/services";
import type { CreateCoMakerData, UpdateCoMakerData } from "@/services/co-maker.service";
import { notifyError } from "@/lib/notify";
import { emptyDrain } from "@/lib/paginate";
import { usePermission } from "@/hooks";
import { toBorrowerPayments, type RepaymentListShortfall } from "@/lib/repayment-list";
import {
  coMakerSaveNotice,
  saveCoMaker,
  type CoMakerSaveAction,
  type CoMakerSaveResult,
} from "@/lib/co-maker-save";
import { coMakerIdFormData, type ReadyCoMakerId } from "@/lib/co-maker-valid-id";
import { BorrowerHeader } from "./_components/borrower-header";
import { TransferMemberDialog } from "./_components/transfer-member-dialog";
import { canTransferMember } from "../_lib/member-transfer";
import { withMembership } from "../_lib/member-membership";
import { OverviewTab } from "./_components/overview-tab";
import { LoansTab } from "./_components/loans-tab";
import { PaymentsTab } from "./_components/payments-tab";
import { useBorrowerLoanSummary } from "./_hooks/use-borrower-loan-summary";
import { CoMakersTab } from "./_components/co-makers-tab";
import { DocumentsTab } from "./_components/documents-tab";
import { LedgerTab } from "./_components/ledger-tab";
import { ShareCapitalTab } from "./_components/share-capital-tab";
import { CollateralsTab } from "./_components/collaterals-tab";
import { SavingsTab } from "./_components/savings-tab";
import { env } from "@/config/env";

function BorrowerDetailContent() {
  const params = useParams();
  const borrowerId = Number(params.id);
  // Anything can follow `/borrowers/` in a hand-edited URL. Only plain digits
  // name a borrower — `Number()` alone reads `1e3` as 1000, `0x10` as 16 and
  // ` 12 ` as 12 — so anything else is "not found" without asking the API.
  const isBorrowerId =
    typeof params.id === "string" && /^\d+$/.test(params.id) && borrowerId > 0;

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
  // A different id is a different page — Next remounts the segment — so this
  // starts over with it. Only `reload` sets it back to true.
  const [loading, setLoading] = useState(isBorrowerId);
  const [reloadCount, setReloadCount] = useState(0);
  // A member's loans need `loans:view` and their payments `payments:view`,
  // neither of which this page implies. Without one, that list is not asked
  // for and its tab shows none.
  const { can } = usePermission();
  // Menu Visibility: the Savings and Share Capital tabs go while their menus are hidden.
  const { isHidden } = useMenuVisibility();
  const parts = memberPageParts(isHidden);
  const canListLoans = can("loans:view");
  const canListPayments = can("payments:view");
  const [transferOpen, setTransferOpen] = useState(false);
  // One read of the server's loan totals for the Overview and Payments tabs.
  const loanSummary = useBorrowerLoanSummary(borrower?.id, loans);

  const fetchCoMakers = useCallback(async () => {
    try {
      const res = await coMakerService.list(borrowerId);
      setCoMakers(Array.isArray(res) ? res : []);
    } catch {
      setCoMakers([]);
    }
  }, [borrowerId]);

  // Runs on mount and on every `reload`. `loading` is already true when it
  // starts, so state is only set once the requests settle.
  useEffect(() => {
    if (!isBorrowerId) return;
    Promise.allSettled([
      borrowerService.detail(borrowerId),
      // Drained across pages. This was `loanService.list({ borrower_id })` —
      // one default page of 15 — so a member past their fifteenth loan had the
      // rest missing from the Loans tab, the Overview and every balance built
      // on them, and missing from the Payments tab too, which was read loan by
      // loan off that same list.
      canListLoans ? loanService.listAll({ borrower_id: borrowerId }) : emptyDrain<Loan>(),
      // One drain over everything the member paid, across all their loans. This
      // was one `repaymentService.list(loanId)` per loan, each the endpoint's
      // default page of 15 and the OLDEST 15, so the tab lost every loan's
      // newest payments and counted what was left. Draining per loan would fix
      // the count but cost a request per loan against a shared 60-a-minute
      // budget, and a member who renews a one-month loan every month holds
      // dozens of them.
      canListPayments
        ? repaymentService.listAll({ borrower_id: borrowerId })
        : emptyDrain<Repayment>(),
    ]).then(async ([borrowerResult, loansResult, paymentsResult]) => {
      if (borrowerResult.status === "fulfilled") {
        setBorrower(borrowerResult.value);
      } else {
        toast.error("We couldn't load the member details. Please try again.");
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
    });
  }, [borrowerId, isBorrowerId, fetchCoMakers, reloadCount, canListLoans, canListPayments]);

  // After a photo change: the whole page goes back to its spinner and reloads.
  const reload = () => {
    setLoading(true);
    setReloadCount((n) => n + 1);
  };

  // Every co-maker save says how it ended — including a co-maker that saved
  // while its ID didn't — and refreshes the list whenever anything was
  // written. The result goes back to the dialog, which closes only on a full
  // success. Errors are worded by getErrorMessage (via coMakerSaveNotice), so
  // a field-level 422 names the field instead of "please try again".
  const finishCoMakerSave = async (
    result: CoMakerSaveResult,
    action: CoMakerSaveAction
  ): Promise<CoMakerSaveResult> => {
    const notice = coMakerSaveNotice(result, action);
    if (notice.tone === "success") toast.success(notice.message);
    else toast.error(notice.message);
    if (result.status !== "failed") await fetchCoMakers();
    return result;
  };

  const uploadCoMakerId = (validId: ReadyCoMakerId) => (coMakerId: number) =>
    coMakerService.uploadValidId(coMakerId, coMakerIdFormData(validId));

  const handleAddCoMaker = async (data: CreateCoMakerData, validId: ReadyCoMakerId | null) =>
    finishCoMakerSave(
      await saveCoMaker(
        async () => (await coMakerService.create(borrowerId, data)).id,
        validId ? uploadCoMakerId(validId) : undefined
      ),
      "add"
    );

  // After an add whose ID failed: the co-maker exists, so only the ID is sent.
  const handleAddCoMakerId = async (coMakerId: number, validId: ReadyCoMakerId) =>
    finishCoMakerSave(await saveCoMaker(async () => coMakerId, uploadCoMakerId(validId)), "id");

  const handleEditCoMaker = async (
    id: number,
    data: UpdateCoMakerData,
    validId: ReadyCoMakerId | null
  ) =>
    finishCoMakerSave(
      await saveCoMaker(
        async () => {
          await coMakerService.update(id, data);
          return id;
        },
        validId ? uploadCoMakerId(validId) : undefined
      ),
      "update"
    );

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
    return <PageLoader />;
  }

  if (!borrower) {
    return (
      <div className={FIT_CLASSES.loader}>
        <p className="text-muted-foreground">Member not found.</p>
      </div>
    );
  }

  // Needs borrowers:view and borrowers:transfer, for a member with a branch.
  const transferable = canTransferMember(can, borrower);

  return (
    <PageFill className="fit:gap-4">
      <BorrowerHeader
        borrower={borrower}
        onEdit={() => router.push(`/borrowers/${borrowerId}/edit`)}
        onPhotoUpdate={reload}
        onTransfer={transferable ? () => setTransferOpen(true) : undefined}
      />
      {transferable && (
        <TransferMemberDialog
          borrower={borrower}
          open={transferOpen}
          onOpenChange={setTransferOpen}
          onTransferred={reload}
        />
      )}

      {/* Member documents — the same catalog `/printables` serves, opened for
          the member already on screen instead of re-picking them there. */}
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          className="shrink-0"
          consequence="The Loans tab, the Overview and the balances on the Payments tab cover only the loans that loaded."
        />
      )}

      {paymentShortfall && (
        <IncompleteListNotice
          shown={paymentShortfall.shown}
          total={paymentShortfall.total}
          noun="payments"
          className="shrink-0"
          consequence="The Payments tab's list and count cover only the payments that loaded."
        />
      )}

      <Tabs defaultValue="overview" className={FIT_CLASSES.section}>
        {/* Below sm the tabs are wider than the screen, so they scroll sideways
            in their own box and the page never does. The box is not the tab
            list itself: the active tab's underline sits just below the list,
            and the padding keeps it inside the scroll box. */}
        <div className="flex shrink-0 max-sm:overflow-x-auto max-sm:pb-1.5">
          <TabsList variant="line" className="shrink-0">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="loans">Loans ({loans.length})</TabsTrigger>
            <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
            <TabsTrigger value="co-makers">Co-Makers ({coMakers.length})</TabsTrigger>
            <TabsTrigger value="documents">Documents &amp; IDs</TabsTrigger>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
            {parts.shareCapitalTab && <TabsTrigger value="share-capital">Share Capital</TabsTrigger>}
            <TabsTrigger value="collaterals">Collaterals</TabsTrigger>
            {env.features.savings && parts.savingsTab && can("savings:view") && <TabsTrigger value="savings">Savings</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="overview" className={cn("pt-4", FIT_CLASSES.section)}>
          <ScrollBox className="p-px">
            <OverviewTab
              borrower={borrower}
              loans={loans}
              coMakers={coMakers}
              summary={loanSummary}
              onMembershipSaved={(saved) => setBorrower((current) => (current ? withMembership(current, saved) : current))}
            />
          </ScrollBox>
        </TabsContent>

        <TabsContent value="loans" className={cn("pt-4", FIT_CLASSES.section)}>
          <LoansTab loans={loans} />
        </TabsContent>

        <TabsContent value="payments" className={cn("pt-4", FIT_CLASSES.section)}>
          <PaymentsTab payments={payments} loans={loans} summary={loanSummary} />
        </TabsContent>

        <TabsContent value="co-makers" className={cn("pt-4", FIT_CLASSES.section)}>
          <ScrollBox className="p-px">
            <CoMakersTab
              coMakers={coMakers}
              onAdd={handleAddCoMaker}
              onAddId={handleAddCoMakerId}
              onEdit={handleEditCoMaker}
              onDelete={handleDeleteCoMaker}
            />
          </ScrollBox>
        </TabsContent>

        <TabsContent value="documents" className={cn("pt-4", FIT_CLASSES.section)}>
          <ScrollBox className="p-px">
            <DocumentsTab borrowerId={borrower.id} />
          </ScrollBox>
        </TabsContent>

        <TabsContent value="ledger" className={cn("pt-4", FIT_CLASSES.section)}>
          <LedgerTab borrowerId={borrower.id} />
        </TabsContent>

        {parts.shareCapitalTab && (
          <TabsContent value="share-capital" className={cn("pt-4", FIT_CLASSES.section)}>
            <ShareCapitalTab borrowerId={borrower.id} />
          </TabsContent>
        )}

        <TabsContent value="collaterals" className={cn("pt-4", FIT_CLASSES.section)}>
          <ScrollBox className="p-px">
            <CollateralsTab borrowerId={borrower.id} />
          </ScrollBox>
        </TabsContent>

        {env.features.savings && parts.savingsTab && can("savings:view") && (
          <TabsContent value="savings" className={cn("pt-4", FIT_CLASSES.section)}>
            <ScrollBox className="p-px">
              <SavingsTab borrowerId={borrower.id} />
            </ScrollBox>
          </TabsContent>
        )}
      </Tabs>
    </PageFill>
  );
}

export default function BorrowerDetailPage() {
  return (
    <RouteGuard permission="borrowers:view" pageName="Member Details">
      <BorrowerDetailContent />
    </RouteGuard>
  );
}
