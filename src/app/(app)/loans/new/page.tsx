"use client";

import { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { RouteGuard } from "@/components/common";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { MissingAccessNotice } from "./_components/missing-access-notice";
import { missingLoanFormAccess } from "./_lib/missing-access";
import { StaffPicker } from "@/components/common/staff-picker";
import {
  collateralLock,
  holdersSentence,
  isLocked as isCollateralLocked,
  lockLabel,
} from "@/lib/collateral-lock";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { notifyError, notifyValidation } from "@/lib/notify";
import { AlertCircle, ArrowLeft, CalendarIcon, Info, ChevronsUpDown, Check, Plus, RefreshCw, X, FileText, ShieldCheck, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  borrowerService,
  collateralService,
  collateralTypeService,
  documentService,
  loanProductService,
  loanService,
} from "@/services";
import { api } from "@/lib/api-client";
import { getErrorMessage, httpStatusOf } from "@/lib/api-error";
import { completeRows, emptyDrain } from "@/lib/paginate";
import { usePermission } from "@/hooks";
import {
  SHARE_CAPITAL_UNAVAILABLE_LABEL,
  getShareCapitalBalance,
} from "@/utils/share-capital";
import {
  collateralValue,
  type CollateralValueRow,
} from "@/utils/collateral-value";
import { securityStatusLabel } from "@/types/collateral";
import type {
  Borrower,
  CollateralType,
  Loan,
  StaffMember,
} from "@/types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateISO, formatRate } from "@/lib/format";
import { currencyOrDash } from "@/lib/report-format";
import {
  decimalInputValue,
  PESO_DECIMALS,
  sanitizeDecimalInput,
} from "@/lib/percent";
import {
  ratePeriodWord,
  readRateFrequency,
  readTermUnit,
  termUnitNoun,
} from "@/lib/loan-terms";
import { editedAccountOfficer } from "@/lib/loan-account-officer";
import {
  applicationDeductions,
  feePercent,
  productDeductionFields,
  storedDeductionFields,
} from "@/lib/loan-application-deductions";
import {
  PROCESSING_FEE_LABEL,
  SERVICE_FEE_LABEL,
  type LoanDeduction,
} from "@/lib/loan-restructure";

import type { LoanProduct } from "@/types/loan";
import {
  PAYMENT_FREQUENCY_OPTIONS,
  PAYMENT_FREQUENCY_LABELS,
} from "@/constants";
import { parseEditLoanId } from "./_lib/edit-loan-id";
import {
  attachedCollateralRows,
  canChangeCollaterals,
  collateralSaveBlock,
  editCollateralLoad,
  statedAttachedCollaterals,
  tracksEditCollaterals,
  type EditCollateralResult,
  type SelectedCollateral,
} from "./_lib/edit-collaterals";
import { memberPicker } from "./_lib/member-picker";
import {
  formInterestMethod,
  interestMethodLabel,
  loanPreviewRequest,
  previewDeductionAmount,
  showsShortBy,
} from "./_lib/loan-preview";
import { useLoanPreview } from "./_hooks/use-loan-preview";
import { parseApiDate } from "@/lib/printables/templates/shared";
import { saveLoanEdit } from "./_lib/save-loan-edit";

// ── Helpers ──

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * A 403 from a list this form only reads for reference. The edit mode below is
 * open to `loans:update`, which `loan_processor` holds without
 * `collaterals:view`. Those reads are skipped for a user without the
 * permission, so a 403 here means it was withdrawn since sign-in. Expected,
 * and nothing a retry fixes, so it is not announced; any other failure is.
 */
function isRoleWithoutAccess(err: unknown): boolean {
  return httpStatusOf(err) === 403;
}

// ── Main Page Component ──
//
// This page handles both **create** and **edit** for a loan application.
// Edit mode is triggered by `?edit={loanId}` — the Edit Loan Application
// button on `/loans/[id]` links here instead of opening an inline dialog
// so the Loan Processor gets the full form (product, term, frequency,
// interest type, policy exception, etc.) after a send-back, matching the
// New Loan experience exactly.

function NewLoanApplicationInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editLoanId = parseEditLoanId(searchParams.get("edit"));
  const isEditMode = editLoanId !== null;
  // Lists this form reads under other modules' permissions, which neither
  // `loans:create` nor `loans:update` implies. Without one, that list is not
  // asked for and stays empty, as it would with nothing in it.
  const { can } = usePermission();
  const canListMembers = can("borrowers:view");
  const canListProducts = can("loans:view");
  const canListCollaterals = can("collaterals:view");
  // Changing a loan's collaterals. Edit mode states them on the loan update,
  // which the server refuses outright without this.
  const canUpdateCollaterals = can("collaterals:update");
  const canReadShareCapital = can("share_capital:view");
  const missingAccess = useMemo(
    () =>
      missingLoanFormAccess({
        members: canListMembers,
        products: canListProducts,
        collaterals: canListCollaterals,
        shareCapital: canReadShareCapital,
      }),
    [canListMembers, canListProducts, canListCollaterals, canReadShareCapital],
  );
  // Said in the picker itself too: "No member found" reads as an empty
  // member list, which is not what is wrong.
  const memberPickerEmpty = canListMembers ? "No member found." : "Your role can't view members.";

  // ── API Data ──
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingLoan, setExistingLoan] = useState<Loan | null>(null);

  // ── Borrower & Co-Maker State ──
  const [borrowerId, setBorrowerId] = useState<number | null>(null);
  const [coMakerIds, setCoMakerIds] = useState<(number | null)[]>([null]);
  const [openCoMakerIndex, setOpenCoMakerIndex] = useState<number | null>(null);
  const [accountOfficer, setAccountOfficer] = useState<StaffMember | null>(null);
  const [purpose, setPurpose] = useState("");

  // ── Loan Product & Terms State ──
  const [productId, setProductId] = useState<string | null>(null);
  const [principalAmount, setPrincipalAmount] = useState<string>("");
  const [termValue, setTermValue] = useState<string>("");
  const [paymentFrequency, setPaymentFrequency] = useState<string | null>(null);
  const [interestRate, setInterestRate] = useState<string>("");
  // Share Capital Build-Up amount (only required when the selected
  // product has scb_required === true; must fall within product min/max)
  const [scbAmount, setScbAmount] = useState<string>("");

  // ── Collaterals State ──
  // Collaterals already persisted to mock storage and registered against
  // the chosen borrower. Re-fetched whenever the borrower changes.
  const [availableCollaterals, setAvailableCollaterals] = useState<
    CollateralValueRow[]
  >([]);
  const [collateralTypes, setCollateralTypes] = useState<CollateralType[]>([]);
  // Collaterals the user has chosen to attach to THIS loan, with the
  // value snapshotted at attach time so post-attach ledger drift doesn't
  // silently move security status.
  const [selectedCollaterals, setSelectedCollaterals] = useState<
    SelectedCollateral[]
  >([]);
  const [collateralPickerOpen, setCollateralPickerOpen] = useState(false);

  // ── Policy Exception State ──
  const [policyException, setPolicyException] = useState(false);
  const [policyExceptionDetails, setPolicyExceptionDetails] = useState("");
  const [policyExceptionLetter, setPolicyExceptionLetter] = useState<File | null>(null);

  // ── Combobox Open State ──
  const [borrowerOpen, setBorrowerOpen] = useState(false);

  // ── Dates State ──
  const [releaseDate, setReleaseDate] = useState<Date | undefined>(new Date());
  const [releaseDateOpen, setReleaseDateOpen] = useState(false);

  // ── Deductions State ──
  // Fee rates are editable percentages constrained to the selected product's
  // min/max range. The peso amounts are the server's (`POST /loans/preview`).
  const [processingFeeRate, setProcessingFeeRate] = useState<string>("");
  const [serviceFeeRate, setServiceFeeRate] = useState<string>("");
  const [editingFeeRate, setEditingFeeRate] = useState<"processing" | "service" | null>(null);
  const [otherDeductions, setOtherDeductions] = useState<{ name: string; amount: string }[]>([]);
  // Deductions the form shows but does not edit — the product's notarial fee,
  // or one stored on the loan being edited — sent back unchanged.
  const [carriedDeductions, setCarriedDeductions] = useState<LoanDeduction[]>([]);
  // Set only when the member drain gave up with pages outstanding, i.e. the
  // member picker is knowingly missing people. Null means complete.
  const [memberShortfall, setMemberShortfall] = useState<{
    shown: number;
    total: number | null;
  } | null>(null);

  // ── Fetch borrowers, products — and the loan when editing ──
  useEffect(() => {
    // Set by the cleanup, so Strict Mode's discarded first mount (or a real
    // unmount) neither writes state nor toasts.
    let cancelled = false;
    async function fetchData() {
      setLoadingData(true);

      const [borrowersResult, productsResult, loanResult] =
        await Promise.allSettled([
          // members_only: pending and rejected applicants are not loan-eligible,
          // and StoreLoanRequest only validates `exists:borrowers,id` — there is no
          // server-side status gate behind this picker.
          // Drained across pages. `per_page: 200` was clamped to 100 by
          // BorrowerController without a word, so member 101 onwards could not
          // be picked and could not be lent to from this screen at all.
          canListMembers ? borrowerService.listAll({ members_only: 1 }) : emptyDrain<Borrower>(),
          canListProducts ? loanProductService.listAll().then(completeRows) : [],
          editLoanId ? loanService.detail(editLoanId) : Promise.resolve(null),
        ]);
      if (cancelled) return;

      if (borrowersResult.status === "fulfilled") {
        const memberDrain = borrowersResult.value;
        setBorrowers(memberDrain.rows);
        setMemberShortfall(
          memberDrain.truncated
            ? { shown: memberDrain.rows.length, total: memberDrain.total }
            : null,
        );
      } else {
        toast.error("We couldn't load members. Please try again.");
      }

      if (productsResult.status === "fulfilled") {
        setProducts(productsResult.value);
      } else {
        toast.error("We couldn't load loan products. Please try again.");
      }

      // Hydrate form state from the loan being edited. Runs after products
      // are loaded so the product-change handler (if used) has them, but
      // we set fields directly to avoid clobbering fee ranges the user may
      // have already tuned on this specific loan.
      if (editLoanId) {
        if (loanResult.status === "fulfilled" && loanResult.value) {
          const loan = loanResult.value;
          setExistingLoan(loan);
          const borrowerIdVal = loan.borrower?.id ?? loan.borrower_id ?? null;
          if (borrowerIdVal) setBorrowerId(Number(borrowerIdVal));
          const coMakerIdList: number[] = Array.isArray(loan.co_makers)
            ? loan.co_makers.map((c) => c.borrower_id).filter((id): id is number => typeof id === "number")
            : [];
          setCoMakerIds(coMakerIdList.length > 0 ? coMakerIdList : [null]);
          if (loan.account_officer) setAccountOfficer(loan.account_officer);
          setPurpose(loan.purpose ?? "");
          const productIdVal = loan.loan_product?.id ?? loan.loan_product_id ?? null;
          if (productIdVal) setProductId(String(productIdVal));
          setPrincipalAmount(String(loan.principal_amount ?? ""));
          setTermValue(String(loan.term ?? loan.term_months ?? ""));
          setPaymentFrequency(String(loan.frequency ?? loan.payment_frequency ?? "monthly"));
          setInterestRate(decimalInputValue(loan.interest_rate));
          setScbAmount(loan.scb_amount != null ? String(loan.scb_amount) : "");
          if (loan.start_date) setReleaseDate(new Date(loan.start_date));
          if (loan.policy_exception) {
            setPolicyException(true);
            setPolicyExceptionDetails(loan.policy_exception_details ?? "");
          }
          // Fees as saved on this loan, not as its product has them today. The
          // product is only the starting point for a loan with none stored.
          const loanProduct = productsResult.status === "fulfilled"
            ? productsResult.value.find((p) => p.id === Number(productIdVal))
            : undefined;
          const deductionFields =
            storedDeductionFields(loan.deductions) ??
            (loanProduct ? productDeductionFields(loanProduct) : null);
          if (deductionFields) {
            setProcessingFeeRate(deductionFields.processingFeeRate);
            setServiceFeeRate(deductionFields.serviceFeeRate);
            setOtherDeductions(deductionFields.otherDeductions);
            setCarriedDeductions(deductionFields.carried);
          }
        } else {
          toast.error("We couldn't load this loan. Redirecting…");
          router.push(`/loans/${editLoanId}`);
        }
      }

      setLoadingData(false);
    }
    fetchData();
    return () => {
      cancelled = true;
    };
    // Re-fetch if user switches between create and edit in the same tab
  }, [editLoanId, router, canListMembers, canListProducts]);

  // ── Collateral types: load once on mount ──
  useEffect(() => {
    if (!canListCollaterals) return;
    let cancelled = false;
    collateralTypeService
      .listAll()
      .then(completeRows)
      .then((rows) => {
        if (!cancelled) setCollateralTypes(rows);
      })
      .catch((err) => {
        // Non-blocking, but not silent: without types a share-capital
        // collateral is valued at its recorded amount instead of the member's
        // balance.
        if (!cancelled && !isRoleWithoutAccess(err)) {
          toast.error("We couldn't load the collateral types, so collateral values may be wrong. Please reload before attaching collateral.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canListCollaterals]);

  // ── Available collaterals: rebuild whenever the borrower changes ──
  // Filters out collaterals already locked to a different active loan
  // (in edit mode the loan being edited is excluded from the lock).
  useEffect(() => {
    if (borrowerId == null || !canListCollaterals) {
      setAvailableCollaterals([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // One request today. `active_loans` on each row is the server's answer
        // to "is this already pledged", across the whole active loan book — no
        // loan list to page and no per-loan attachment fan-out to bound.
        // Drained so a paginated `/collaterals` cannot hand the picker page 1
        // as the member's whole set.
        const collateralRows = completeRows(
          await collateralService.listAll({ borrower_id: borrowerId }),
        );
        const typeById = new Map(collateralTypes.map((t) => [t.id, t]));
        const needsScBalance = collateralRows.some(
          (c) =>
            typeById.get(c.collateral_type_id)?.source === "share_capital",
        );
        const scBalance = needsScBalance
          ? await getShareCapitalBalance(borrowerId, canReadShareCapital)
          : null;
        const enriched: CollateralValueRow[] = collateralRows.map((c) => {
          const t = typeById.get(c.collateral_type_id);
          return {
            ...c,
            type: t,
            // In edit mode the loan being edited is not a conflict with itself —
            // the user must be able to keep the security it already holds.
            lock: collateralLock(c, { exceptLoanId: editLoanId }),
            // `value_unknown` when this is a share-capital collateral whose
            // ledger could not be read in full. Attaching such a row would
            // write its value onto the loan as `snapshot_value` — a permanent
            // appraisal derived from part of a ledger — so the picker refuses
            // it below rather than booking one.
            ...collateralValue(c, t, scBalance),
          };
        });
        if (!cancelled) setAvailableCollaterals(enriched);
      } catch (err) {
        if (cancelled) return;
        setAvailableCollaterals([]);
        if (!isRoleWithoutAccess(err)) {
          toast.error("We couldn't load this member's collaterals. Please try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [borrowerId, collateralTypes, editLoanId, canListCollaterals, canReadShareCapital]);

  // ── Edit mode: the loan's attached collaterals ──
  // Read on their own, not after the collateral types and the member's
  // collaterals: waiting on those left a loan whose member has none
  // registered, or whose list was slow or failed, with no collaterals on the
  // form, and saving then detached them all. Save waits for this read
  // (`collateralSaveBlock`), because the save states the loan's collaterals
  // from it.
  const tracksCollaterals = tracksEditCollaterals(isEditMode, canListCollaterals);
  const [collateralReload, setCollateralReload] = useState(0);
  const [collateralResult, setCollateralResult] = useState<EditCollateralResult | null>(null);
  useEffect(() => {
    if (!editLoanId || !canListCollaterals) return;
    const request = `${editLoanId}:${collateralReload}`;
    let cancelled = false;
    collateralService
      .listForLoan(editLoanId)
      .then((links) => {
        if (cancelled) return;
        const attached = attachedCollateralRows(links, editLoanId);
        setSelectedCollaterals(attached);
        setCollateralResult({ request, attached, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setCollateralResult({
          request,
          attached: null,
          error: getErrorMessage(err, "Please try again."),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [editLoanId, canListCollaterals, collateralReload]);
  const collateralLoad = tracksCollaterals
    ? editCollateralLoad(collateralResult, `${editLoanId}:${collateralReload}`)
    : null;
  const collateralBlock = collateralSaveBlock(collateralLoad);
  // In edit mode the collaterals can be changed once the loan's are known, and
  // only by a role that may change them; otherwise the save never states them.
  const canEditCollaterals = canChangeCollaterals(isEditMode, collateralLoad, canUpdateCollaterals);
  const attachedCollaterals = statedAttachedCollaterals(
    isEditMode,
    collateralLoad,
    canUpdateCollaterals,
    collateralResult,
  );

  // Co-makers: all borrowers except the selected borrower and already-picked co-makers
  const availableCoMakersFor = useCallback(
    (currentIndex: number) => {
      const pickedElsewhere = new Set(
        coMakerIds.filter((id, i) => id !== null && i !== currentIndex) as number[]
      );
      return borrowers.filter((b) => b.id !== borrowerId && !pickedElsewhere.has(b.id));
    },
    [borrowers, borrowerId, coMakerIds]
  );

  // ── Derived ──
  const selectedBorrower = useMemo(
    () => borrowers.find((b) => b.id === borrowerId) ?? null,
    [borrowerId, borrowers]
  );
  const member = memberPicker(
    isEditMode,
    selectedBorrower?.full_name ?? null,
    existingLoan?.borrower?.full_name ?? existingLoan?.borrower?.name ?? null,
  );
  const selectedProduct = useMemo(
    () => (productId ? products.find((p) => p.id === Number(productId)) ?? null : null),
    [productId, products]
  );

  // Frequencies allowed by the selected product (empty = no product selected = all)
  const productFrequencies = useMemo<string[]>(() => {
    if (!selectedProduct) return [];
    const ap = selectedProduct as unknown as Record<string, unknown>;
    const raw = ap.frequencies ?? ap.frequency ?? selectedProduct.payment_frequency;
    if (Array.isArray(raw)) return raw as string[];
    return raw ? [String(raw)] : [];
  }, [selectedProduct]);

  // `term` is a length in the product's unit — months unless it says days.
  const termUnit = readTermUnit(selectedProduct?.term_unit);
  // …and the rate is quoted per the product's rate frequency.
  const rateFrequency = readRateFrequency(selectedProduct?.interest_rate_frequency);
  const principal = parseFloat(principalAmount) || 0;
  const term = parseInt(termValue) || 0;
  const rate = parseFloat(interestRate) || 0;
  const scb = parseFloat(scbAmount) || 0;

  // Validation messages
  const principalError = useMemo(() => {
    if (!selectedProduct || !principalAmount) return null;
    if (principal < selectedProduct.min_amount)
      return `Minimum amount is ${formatCurrency(selectedProduct.min_amount)}`;
    if (principal > selectedProduct.max_amount)
      return `Maximum amount is ${formatCurrency(selectedProduct.max_amount)}`;
    return null;
  }, [selectedProduct, principalAmount, principal]);

  const termError = useMemo(() => {
    if (!selectedProduct || !termValue) return null;
    if (term < selectedProduct.min_term)
      return `Minimum term is ${selectedProduct.min_term} ${termUnitNoun(termUnit)}`;
    if (term > selectedProduct.max_term)
      return `Maximum term is ${selectedProduct.max_term} ${termUnitNoun(termUnit)}`;
    return null;
  }, [selectedProduct, termValue, term, termUnit]);

  // SCB validation — required when the product says so; range-checked when
  // the product defines min/max. Otherwise optional (any value >= 0 is fine).
  const scbError = useMemo(() => {
    if (!scbAmount || scb === 0) {
      // Empty/zero SCB is only an error when the product requires it
      return selectedProduct?.scb_required
        ? "Share Capital Build-Up amount is required"
        : null;
    }
    if (scb < 0) return "SCB cannot be negative";
    const min = selectedProduct?.min_scb ?? 0;
    const max = selectedProduct?.max_scb ?? 0;
    if (min > 0 && scb < min) return `Minimum SCB is ${formatCurrency(min)}`;
    if (max > 0 && scb > max) return `Maximum SCB is ${formatCurrency(max)}`;
    return null;
  }, [selectedProduct, scbAmount, scb]);

  // Fees — percent × principal. The percent is user-editable but bounded
  // by the product's min/max range (if defined on the product).
  const processingFeeRange = useMemo(() => ({
    min: Number(selectedProduct?.min_processing_fee ?? 0),
    max: Number(selectedProduct?.max_processing_fee ?? selectedProduct?.processing_fee ?? 0),
  }), [selectedProduct]);
  const serviceFeeRange = useMemo(() => ({
    min: Number(selectedProduct?.min_service_fee ?? 0),
    max: Number(selectedProduct?.max_service_fee ?? selectedProduct?.service_fee ?? 0),
  }), [selectedProduct]);


  // A blank field stands for the product's rate; "0" waives the fee.
  const processingFeePercent = feePercent(processingFeeRate, selectedProduct?.processing_fee);
  const serviceFeePercent = feePercent(serviceFeeRate, selectedProduct?.service_fee);

  const processingFeePercentError = useMemo(() => {
    if (!selectedProduct || processingFeeRange.max <= 0) return null;
    if (processingFeePercent < processingFeeRange.min || processingFeePercent > processingFeeRange.max) {
      return `Must be between ${processingFeeRange.min}% and ${processingFeeRange.max}%`;
    }
    return null;
  }, [selectedProduct, processingFeePercent, processingFeeRange]);

  const serviceFeePercentError = useMemo(() => {
    if (!selectedProduct || serviceFeeRange.max <= 0) return null;
    if (serviceFeePercent < serviceFeeRange.min || serviceFeePercent > serviceFeeRange.max) {
      return `Must be between ${serviceFeeRange.min}% and ${serviceFeeRange.max}%`;
    }
    return null;
  }, [selectedProduct, serviceFeePercent, serviceFeeRange]);

  // The deductions the application states, exactly as sent. What they come to
  // in pesos is the server's preview, below.
  const deductions = useMemo(
    () =>
      applicationDeductions({
        processingFeePercent,
        serviceFeePercent,
        otherDeductions,
        carried: carriedDeductions,
      }),
    [processingFeePercent, serviceFeePercent, otherDeductions, carriedDeductions],
  );
  // The two fee fields' own items in that list; carried items are matched on
  // their own, so a carried fee sharing a name is never read as the field's.
  const processingFeeInput = deductions.find(
    (d) => d.type === "percentage" && d.name === PROCESSING_FEE_LABEL && !carriedDeductions.includes(d),
  );
  const serviceFeeInput = deductions.find(
    (d) => d.type === "percentage" && d.name === SERVICE_FEE_LABEL && !carriedDeductions.includes(d),
  );

  // Shown read-only: the server builds the loan with its product's method.
  const interestMethod = formInterestMethod({
    product: selectedProduct,
    storedMethod: existingLoan
      ? (existingLoan.interest_method ?? existingLoan.interest_type ?? null)
      : null,
  });

  // Amortization preview — shown as soon as the core loan terms are valid.
  // SCB errors do NOT block the preview (we want the user to see the SCB
  // column with their current value); SCB errors only block submission.
  const canShowAmortization =
    principal > 0 &&
    term > 0 &&
    rate > 0 &&
    paymentFrequency !== null &&
    interestMethod !== null &&
    releaseDate !== undefined &&
    !principalError &&
    !termError;

  // The collateral total, security status, shortfall, maturity date,
  // deductions, net proceeds and amortization schedule are the server's
  // (`POST /loans/preview`), asked for whenever the terms, the deductions or
  // the attached collaterals change. The form works none of them out: while a
  // preview is on its way, or after one failed, it shows no figures.
  const { view: preview, retry: retryPreview } = useLoanPreview(
    loanPreviewRequest({
      productId,
      principalAmount,
      interestRate,
      termValue,
      paymentFrequency,
      releaseDate,
      scbAmount,
      collaterals: selectedCollaterals,
      // As the save states them: only once the product is known.
      deductions: selectedProduct ? deductions : null,
    }),
  );
  const previewCollateral = preview.status === "ready" ? preview.preview.collateral : null;
  const amortization = preview.status === "ready" ? preview.preview.amortization : null;
  const previewMaturity = preview.status === "ready" ? preview.preview.maturity_date : null;
  const previewDeductions = preview.status === "ready" ? preview.preview.deductions : null;

  // Picker rows: show all of the borrower's collaterals, but disable the
  // ones already selected here or locked to a different active loan.
  const pickerRows = useMemo(() => {
    const selectedIds = new Set(
      selectedCollaterals.map((c) => c.collateral.id),
    );
    return availableCollaterals.map((c) => ({
      collateral: c,
      isSelected: selectedIds.has(c.id),
      isLocked: isCollateralLocked(c.lock),
      // Not selectable: there is no value to attach it at. Refusing here is
      // the point — the alternative is a loan secured at a figure nobody
      // computed, which nothing downstream can tell from a real appraisal.
      isValueUnknown: c.value_unknown,
    }));
  }, [availableCollaterals, selectedCollaterals]);

  // ── Product Selection Handler ──
  const handleProductChange = useCallback(
    (value: string | null) => {
      setProductId(value);
      const product = products.find((p) => p.id === Number(value));
      if (product) {
        const apiProduct = product as unknown as Record<string, unknown>;
        const rawRate = apiProduct.min_interest_rate ?? apiProduct.interest_rate ?? product.interest_rate;
        setInterestRate(decimalInputValue(rawRate));
        // Auto-select payment frequency from the product's frequencies array
        const rawFreqs = apiProduct.frequencies ?? apiProduct.frequency ?? product.payment_frequency;
        const freqArray = Array.isArray(rawFreqs) ? rawFreqs as string[] : rawFreqs ? [String(rawFreqs)] : ["monthly"];
        setPaymentFrequency(String(freqArray[0] ?? "monthly"));
        // Seed the fees with exactly what the server charges from this product
        // when it adds them itself. Other deductions are the operator's own and
        // stay.
        const productFees = productDeductionFields(product);
        setProcessingFeeRate(productFees.processingFeeRate);
        setServiceFeeRate(productFees.serviceFeeRate);
        setCarriedDeductions(productFees.carried);
        // Seed SCB amount when the product requires it: default to the product's
        // minimum. The loan officer can adjust up to the product's maximum.
        if (product.scb_required) {
          setScbAmount(String(product.min_scb ?? ""));
        } else {
          setScbAmount("");
        }
      }
    },
    [products]
  );

  // ── Borrower Selection Handler ──
  // A new application only: an edit's member is fixed (`memberPicker`).
  const handleBorrowerChange = useCallback((id: number | null) => {
    setBorrowerId(id);
    setCoMakerIds([null]);
    // Collaterals are per-borrower — drop any selections from the previous
    // member so they don't get accidentally attached to the new loan.
    setSelectedCollaterals([]);
  }, []);

  // ── Co-Maker Slot Handlers ──
  function addCoMakerSlot() {
    setCoMakerIds((prev) => [...prev, null]);
  }

  function removeCoMakerSlot(index: number) {
    setCoMakerIds((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [null] : next;
    });
  }

  function setCoMakerAt(index: number, id: number | null) {
    setCoMakerIds((prev) => prev.map((v, i) => (i === index ? id : v)));
  }

  // ── Submit ──
  const handleSubmit = async () => {
    if (collateralBlock) return;
    // Collect every field the user still needs to fix and surface them in a
    // single consolidated pop-up instead of inline red messages.
    const missing: string[] = [];
    if (borrowerId === null) missing.push("Borrower");
    if (productId === null) missing.push("Loan product");
    if (!(principal > 0) || principalError) missing.push("Principal amount");
    if (!(term > 0) || termError) missing.push("Term");
    if (paymentFrequency === null) missing.push("Payment frequency");
    if (!(rate > 0)) missing.push("Interest rate");
    if (releaseDate === undefined) missing.push("Release date");
    if (scbError) missing.push("Share Capital Build-Up");
    if (processingFeePercentError) missing.push("Processing fee");
    if (serviceFeePercentError) missing.push("Service fee");
    if (missing.length > 0) {
      notifyValidation(missing);
      return;
    }
    // Narrow the nullable form state before building the payload.
    if (
      borrowerId === null ||
      productId === null ||
      paymentFrequency === null ||
      releaseDate === undefined
    )
      return;
    try {
      setSubmitting(true);
      const payload = {
        borrower_id: borrowerId,
        co_maker_ids: coMakerIds.filter((id): id is number => id !== null),
        loan_product_id: Number(productId),
        principal_amount: principal,
        // Loan terms chosen on the form. These were previously omitted from
        // the payload, so the backend fell back to product defaults (e.g. the
        // product's max term) — making the saved term/frequency, and the
        // backend-computed maturity date and total payable, differ from what
        // the user entered. No `interest_method`: the server snapshots it from
        // the product and ignores one sent.
        term,
        frequency: paymentFrequency,
        interest_rate: rate,
        start_date: formatDateISO(releaseDate),
        ...(scb > 0 && { scb_amount: scb }),
        // Stated whenever the product is known. Sent none, the server charged
        // the product's own fee rates and dropped every edit and other
        // deduction made here. Without the product (its list failed to load)
        // they are left to the server, as before: an edit stating an empty list
        // would clear the loan's fees.
        ...(selectedProduct && { deductions }),
        // A new loan states its officer, `null` for none. An edit sends one
        // only when it changed, so an officer deactivated since does not
        // block saving the rest of the loan.
        ...(isEditMode
          ? editedAccountOfficer(accountOfficer, existingLoan?.account_officer ?? null)
          : { account_officer_id: accountOfficer?.id ?? null }),
        ...(purpose.trim() && { purpose: purpose.trim() }),
        ...(policyException && {
          policy_exception: true,
          policy_exception_details: policyExceptionDetails.trim() || undefined,
        }),
      };

      // Edit mode — update existing loan, skip auto-submit (the loan is
      // already beyond draft and already in the approval chain).
      if (isEditMode && editLoanId) {
        // Collaterals go in the same update, and only when they changed.
        const updated = await saveLoanEdit(
          editLoanId,
          payload,
          selectedCollaterals,
          attachedCollaterals,
        );

        if (policyException && policyExceptionLetter) {
          try {
            const letterData = new FormData();
            letterData.append("file", policyExceptionLetter);
            letterData.append("type", "policy_exception_letter");
            await api.upload(`/loans/${updated.id}/documents`, letterData);
          } catch {
            toast.warning("Loan updated but policy exception letter upload failed");
          }
        }

        toast.success("Loan application updated");
        router.push(`/loans/${updated.id}`);
        return;
      }

      // Create mode
      const loan = await loanService.create(payload);

      // Attach selected collaterals. Snapshot value is captured here so
      // a future change to the underlying balance / amount does not retro-
      // actively change this loan's security status.
      if (selectedCollaterals.length > 0 && loan.id) {
        try {
          await Promise.all(
            selectedCollaterals.map((s) =>
              collateralService.attachToLoan(
                loan.id,
                s.collateral.id,
                s.snapshot_value,
              ),
            ),
          );
        } catch {
          toast.warning(
            "Loan created but some collaterals failed to attach — open the loan to retry.",
          );
        }
      }

      // Upload policy exception letter if provided
      if (policyException && policyExceptionLetter && loan.id) {
        try {
          const letterData = new FormData();
          letterData.append("file", policyExceptionLetter);
          letterData.append("type", "policy_exception_letter");
          letterData.append("label", policyExceptionLetter.name);
          await documentService.loanUpload(loan.id, letterData);
        } catch {
          toast.warning("Loan created but policy exception letter upload failed");
        }
      }

      // Auto-forward to Manager: creating the loan IS the Loan Processor's action,
      // so skip the redundant "Submit for Review" click on the detail page.
      let forwarded = false;
      try {
        await loanService.submit(loan.id);
        forwarded = true;
      } catch {
        toast.warning(
          "Loan created but could not be forwarded for review. Open the loan to submit it manually."
        );
      }

      toast.success("Loan application created", {
        description: forwarded
          ? "Forwarded to Manager for approval."
          : "Loan application has been created.",
      });
      router.push(`/loans/${loan.id}`);
    } catch (err: unknown) {
      notifyError(
        err,
        isEditMode
          ? "We couldn't update this loan. Please try again."
          : "We couldn't create this loan. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-10">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link
            href={isEditMode && editLoanId ? `/loans/${editLoanId}` : "/loans"}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            {isEditMode ? "Back to Loan" : "Back to Loans"}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditMode ? "Edit Loan Application" : "New Loan Application"}
          </h1>
          {isEditMode && existingLoan?.application_number && (
            <p className="text-sm text-muted-foreground font-mono">
              {existingLoan.application_number}
            </p>
          )}
        </div>
      </div>

      <MissingAccessNotice missing={missingAccess} />

      {memberShortfall && (
        <IncompleteListNotice
          shown={memberShortfall.shown}
          total={memberShortfall.total}
          noun="members"
          consequence="Some members are missing from the member and co-maker pickers below and cannot be selected."
        />
      )}

      {/* ── Card 1: Borrower & Co-Maker ── */}
      <Card>
        <CardHeader>
          <CardTitle>Member & Co-Maker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Borrower */}
            <div className="space-y-2">
              <div className="flex h-6 items-center">
                <Label htmlFor={member.locked ? "loan-member" : undefined}>
                  Member <span className="text-destructive">*</span>
                </Label>
              </div>
              {member.locked ? (
                <>
                  <Input
                    id="loan-member"
                    value={member.label ?? ""}
                    disabled
                    readOnly
                    aria-describedby="loan-member-note"
                  />
                  <p id="loan-member-note" className="text-xs text-muted-foreground">
                    The member can&rsquo;t be changed after the application is
                    created.
                  </p>
                </>
              ) : (
              <Popover open={borrowerOpen} onOpenChange={setBorrowerOpen}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      // eslint-disable-next-line jsx-a11y/role-has-required-aria-props -- Base UI PopoverTrigger sets aria-expanded and aria-controls on this button at runtime
                      role="combobox"
                      aria-expanded={borrowerOpen}
                      className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    />
                  }
                >
                  <span className={cn("truncate", !selectedBorrower && "text-muted-foreground")}>
                    {selectedBorrower
                      ? selectedBorrower.full_name
                      : "Search member..."}
                  </span>
                  <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-(--anchor-width) p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Type a name to search..." />
                    <CommandList>
                      <CommandEmpty>{memberPickerEmpty}</CommandEmpty>
                      <CommandGroup>
                        {borrowers.map((b) => (
                          <CommandItem
                            key={b.id}
                            value={`${b.full_name} ${b.borrower_code}`}
                            onSelect={() => {
                              handleBorrowerChange(
                                b.id === borrowerId ? null : b.id
                              );
                              setBorrowerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 size-4",
                                borrowerId === b.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {b.full_name}{" "}
                            <span className="text-muted-foreground">
                              ({b.borrower_code})
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              )}
            </div>

            {/* Co-Makers */}
            <div className="space-y-2">
              <div className="flex h-6 items-center justify-between">
                <Label>Co-Maker{coMakerIds.length > 1 ? "s" : ""}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-xs text-brand-orange hover:text-brand-orange hover:bg-brand-orange/10"
                  onClick={addCoMakerSlot}
                >
                  <Plus className="h-3 w-3" />
                  Add Co-Maker
                </Button>
              </div>
              <div className="space-y-2">
                {coMakerIds.map((selectedId, index) => {
                  const options = availableCoMakersFor(index);
                  const selected = selectedId ? borrowers.find((b) => b.id === selectedId) : null;
                  const isOpen = openCoMakerIndex === index;
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <Popover
                        open={isOpen}
                        onOpenChange={(o) => setOpenCoMakerIndex(o ? index : null)}
                      >
                        <PopoverTrigger
                          render={
                            <button
                              type="button"
                              // eslint-disable-next-line jsx-a11y/role-has-required-aria-props -- Base UI PopoverTrigger sets aria-expanded and aria-controls on this button at runtime
                              role="combobox"
                              aria-expanded={isOpen}
                              disabled={options.length === 0}
                              className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                            />
                          }
                        >
                          <span className={cn("truncate", !selectedId && "text-muted-foreground")}>
                            {selected
                              ? (selected.full_name ?? `${selected.first_name} ${selected.last_name}`)
                              : !canListMembers
                                ? "Your role can't view members"
                                : options.length === 0
                                ? "No members available"
                                : "Search co-maker (optional)..."}
                          </span>
                          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                        </PopoverTrigger>
                        <PopoverContent className="w-(--anchor-width) p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Type a name to search..." />
                            <CommandList>
                              <CommandEmpty>No members found.</CommandEmpty>
                              <CommandGroup>
                                {options.map((b) => (
                                  <CommandItem
                                    key={b.id}
                                    value={b.full_name ?? `${b.first_name} ${b.last_name}`}
                                    onSelect={() => {
                                      setCoMakerAt(index, b.id === selectedId ? null : b.id);
                                      setOpenCoMakerIndex(null);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 size-4",
                                        selectedId === b.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {b.full_name ?? `${b.first_name} ${b.last_name}`}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {coMakerIds.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeCoMakerSlot(index)}
                          title="Remove co-maker"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Account Officer */}
          <div className="space-y-2">
            <Label htmlFor="account-officer">Account Officer (AO)</Label>
            <StaffPicker
              id="account-officer"
              value={accountOfficer}
              onChange={setAccountOfficer}
              clearable
            />
          </div>

          {/* Purpose */}
          <div className="space-y-2">
            <Label>Purpose</Label>
            <Textarea
              placeholder="Briefly describe the purpose of this loan"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="min-h-20"
            />
          </div>

          <Separator />

          {/* Policy Exception */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="policy-exception"
                checked={policyException}
                onCheckedChange={(checked) => {
                  setPolicyException(checked === true);
                  if (!checked) {
                    setPolicyExceptionDetails("");
                    setPolicyExceptionLetter(null);
                  }
                }}
              />
              <div>
                <Label htmlFor="policy-exception" className="cursor-pointer font-medium">
                  Policy Exception
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Check this if the loan requires policy exception approval (full BOD review)
                </p>
              </div>
            </div>

            {policyException && (
              <div className="space-y-4 rounded-lg border border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-900/10 p-4">
                {/* Policy Exception Details */}
                <div className="space-y-2">
                  <Label htmlFor="pe-details">Policy Exception Details</Label>
                  <Textarea
                    id="pe-details"
                    placeholder="Describe why this loan requires a policy exception..."
                    value={policyExceptionDetails}
                    onChange={(e) => setPolicyExceptionDetails(e.target.value)}
                    className="min-h-20"
                  />
                </div>

                {/* Policy Exception Letter Upload */}
                <div className="space-y-2">
                  <Label>Policy Exception Letter</Label>
                  {policyExceptionLetter ? (
                    <div className="flex items-center gap-3 rounded-lg border p-3 bg-background">
                      <FileText className="h-5 w-5 text-brand-orange shrink-0" />
                      <span className="text-sm truncate flex-1">{policyExceptionLetter.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPolicyExceptionLetter(null)}
                        className="text-destructive hover:text-destructive shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 cursor-pointer rounded-lg border border-dashed border-muted-foreground/30 px-4 py-3 hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-colors">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Click to upload policy exception letter</p>
                        <p className="text-xs text-muted-foreground/70">PDF, DOC, or image file</p>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setPolicyExceptionLetter(file);
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Card 2: Loan Product & Terms ── */}
      <Card>
        <CardHeader>
          <CardTitle>Loan Product & Terms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product */}
          <div className="space-y-2">
            <Label>
              Loan Product <span className="text-destructive">*</span>
            </Label>
            <Select
              value={productId ?? null}
              onValueChange={(value) => handleProductChange(value)}
              items={products.map((p) => ({ value: String(p.id), label: p.name }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a loan product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)} disabled={!p.is_active}>
                    {p.name}
                    {!p.is_active && (
                      <span className="text-muted-foreground"> (Inactive)</span>
                    )}
                    {p.description && (
                      <span className="text-muted-foreground">
                        {" "}
                        — {p.description}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProduct && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Info className="size-3" />
                Amount: {formatCurrency(selectedProduct.min_amount)} –{" "}
                {formatCurrency(selectedProduct.max_amount)} | Term:{" "}
                {selectedProduct.min_term} – {selectedProduct.max_term} {termUnit}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Principal Amount */}
            <div className="space-y-2">
              <Label>
                Loan Amount <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                placeholder="0"
                step="1"
                value={principalAmount}
                onChange={(e) => setPrincipalAmount(e.target.value.replace(/\D/g, ""))}
                min={selectedProduct?.min_amount}
                max={selectedProduct?.max_amount}
              />
            </div>

            {/* Term */}
            <div className="space-y-2">
              <Label>
                Term ({termUnit}) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                placeholder="0"
                step="1"
                value={termValue}
                onChange={(e) => setTermValue(e.target.value.replace(/\D/g, ""))}
                min={selectedProduct?.min_term}
                max={selectedProduct?.max_term}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Payment Frequency */}
            <div className="space-y-2">
              <Label>Payment Frequency</Label>
              <Select
                value={paymentFrequency ?? null}
                onValueChange={(value) => setPaymentFrequency(value ?? null)}
                disabled={productFrequencies.length === 1}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select frequency">
                    {(value: string | null) =>
                      value ? (PAYMENT_FREQUENCY_LABELS[value] ?? value) : "Select frequency"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(productFrequencies.length > 0
                    ? PAYMENT_FREQUENCY_OPTIONS.filter((o) => productFrequencies.includes(o.value))
                    : PAYMENT_FREQUENCY_OPTIONS
                  ).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {productFrequencies.length === 1 && (
                <p className="text-xs text-muted-foreground">Set by loan product</p>
              )}
            </div>

            {/* Interest Rate */}
            <div className="space-y-2">
              <Label>Interest Rate (% per {ratePeriodWord(rateFrequency)})</Label>
              <Input
                inputMode="decimal"
                placeholder="0"
                value={interestRate}
                onChange={(e) => setInterestRate(sanitizeDecimalInput(e.target.value))}
              />
            </div>

            {/* Interest Type — read-only: the server snapshots it from the product */}
            <div className="space-y-2">
              <Label htmlFor="interest-type">Interest Type</Label>
              {/* <output> is labelable, so the read-only value keeps its label */}
              <output
                id="interest-type"
                className="flex h-8 items-center rounded-lg border border-input bg-muted/30 px-2.5 text-sm"
              >
                {interestMethod ? (
                  interestMethodLabel(interestMethod)
                ) : (
                  <span className="text-muted-foreground">Select a product first</span>
                )}
              </output>
              <p className="text-xs text-muted-foreground">Set by loan product</p>
            </div>
          </div>

          {/* Share Capital Build-Up — always visible when a product is
              selected. Required when product has scb_required; optional
              otherwise. This ensures the tester / user can always enter an
              SCB amount regardless of backend product config. */}
          {selectedProduct && (
            <div className="mt-4 rounded-lg border border-brand-orange/30 bg-brand-orange/5 p-4 space-y-3">
              <div className="space-y-0.5">
                <Label htmlFor="scb-amount" className="text-sm font-medium">
                  Share Capital Build-Up{" "}
                  {selectedProduct.scb_required ? (
                    <span className="text-destructive">*</span>
                  ) : (
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  )}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {selectedProduct.scb_required
                    ? "This product requires a Share Capital Build-Up amount per period."
                    : "Enter an amount to add Share Capital Build-Up to each amortization period."}{" "}
                  The SCB portion will be credited to the member&rsquo;s share
                  capital each time they pay.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Input
                    id="scb-amount"
                    type="number"
                    min={selectedProduct.min_scb ?? 0}
                    max={selectedProduct.max_scb ?? undefined}
                    step="1"
                    placeholder="0"
                    value={scbAmount}
                    onChange={(e) => setScbAmount(e.target.value)}
                  />
                </div>
                {selectedProduct.scb_required && (selectedProduct.min_scb ?? 0) > 0 && (
                  <div className="flex items-center text-xs text-muted-foreground">
                    Allowed range:{" "}
                    <span className="ml-1 font-medium text-foreground">
                      {formatCurrency(selectedProduct.min_scb ?? 0)} –{" "}
                      {formatCurrency(selectedProduct.max_scb ?? 0)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Card 3: Collaterals ──
          Only for a role that can view collaterals. Without `collaterals:view`
          the member's collaterals are never read, so the card could only say
          "no registered collaterals" and offer a register link the role can't
          use; the missing-access notice above says what is skipped instead. */}
      {canListCollaterals && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-brand-blue" />
                  Collaterals
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Attach the member&rsquo;s registered collaterals to secure
                  this loan. Only collaterals not currently locked to another
                  active loan can be selected.
                </p>
                {isEditMode && !canUpdateCollaterals && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your role can view this loan&rsquo;s collaterals but not
                    change them.
                  </p>
                )}
              </div>
              {(!isEditMode || canUpdateCollaterals) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCollateralPickerOpen(true)}
                  disabled={borrowerId === null || !canEditCollaterals}
                >
                  <Plus className="mr-2 size-4" />
                  Add Collateral
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {collateralLoad === "loading" ? (
              <div
                role="status"
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Spinner className="size-4" />
                Loading this loan&rsquo;s collaterals…
              </div>
            ) : collateralLoad === "error" ? (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
              >
                <AlertCircle
                  className="mt-0.5 size-4 shrink-0 text-destructive"
                  aria-hidden="true"
                />
                <div className="flex-1 space-y-2">
                  <p className="font-medium">
                    We couldn&rsquo;t load this loan&rsquo;s collaterals.
                  </p>
                  <p className="text-muted-foreground">
                    {collateralResult?.error} Saving is off until they load, so
                    the loan&rsquo;s collaterals stay as they are.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCollateralReload((n) => n + 1)}
                  >
                    <RefreshCw className="mr-2 size-4" />
                    Retry
                  </Button>
                </div>
              </div>
            ) : borrowerId === null ? (
              <p className="text-sm text-muted-foreground">
                Pick a member first to load their registered collaterals.
              </p>
            ) : selectedCollaterals.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <ShieldCheck className="mx-auto size-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  No collaterals attached
                </p>
                <p className="mt-1 text-xs text-muted-foreground/80">
                  {availableCollaterals.length === 0
                    ? "This member has no registered collaterals yet."
                    : canEditCollaterals
                      ? "Click “Add Collateral” to attach one."
                      : null}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedCollaterals.map(({ collateral: c, snapshot_value }) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2"
                  >
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {c.type?.name ?? "Unknown"}
                      </Badge>
                      <span className="text-sm font-medium">
                        {c.detail_value}
                      </span>
                      {c.type?.source === "share_capital" && (
                        <span className="text-xs text-muted-foreground">
                          (auto-derived)
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(snapshot_value)}
                    </span>
                    {canEditCollaterals && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setSelectedCollaterals((prev) =>
                            prev.filter((s) => s.collateral.id !== c.id),
                          )
                        }
                        aria-label="Remove collateral"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {selectedCollaterals.length > 0 && (
              <div
                className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                aria-live="polite"
                aria-busy={preview.status === "loading"}
              >
                <div>
                  <p className="text-xs text-muted-foreground">
                    Total Collateral Value
                  </p>
                  <p className="text-lg font-bold tabular-nums">
                    {previewCollateral
                      ? formatCurrency(previewCollateral.total_value)
                      : "—"}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-1 sm:items-end">
                  {preview.status === "error" ? (
                    <div role="alert" className="flex flex-col items-start gap-2 text-sm sm:items-end">
                      <p className="flex items-center gap-1.5 text-destructive">
                        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                        We couldn&rsquo;t load the collateral preview.
                      </p>
                      <p className="text-xs text-muted-foreground">{preview.message}</p>
                      <Button type="button" variant="outline" size="sm" onClick={retryPreview}>
                        <RefreshCw className="mr-2 size-4" />
                        Retry
                      </Button>
                    </div>
                  ) : previewCollateral ? (
                    <>
                      <Badge
                        className={cn(
                          previewCollateral.security_status === "secured" &&
                            "bg-green-500/15 text-green-700 hover:bg-green-500/15",
                          previewCollateral.security_status === "partially_secured" &&
                            "bg-amber-500/15 text-amber-700 hover:bg-amber-500/15",
                          previewCollateral.security_status === "unsecured" &&
                            "bg-destructive/15 text-destructive hover:bg-destructive/15",
                        )}
                      >
                        {securityStatusLabel(previewCollateral.security_status)}
                      </Badge>
                      {showsShortBy(previewCollateral, principal) && (
                        <p className="text-xs text-muted-foreground">
                          Short by{" "}
                          <span className="font-medium text-foreground">
                            {formatCurrency(previewCollateral.short_by)}
                          </span>{" "}
                          vs. principal
                        </p>
                      )}
                    </>
                  ) : (
                    <span role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Spinner className="size-4" />
                      Checking security…
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Card 4: Dates ── */}
      <Card>
        <CardHeader>
          <CardTitle>Dates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Release Date */}
            <div className="space-y-2">
              <Label>
                Release Date <span className="text-destructive">*</span>
              </Label>
              <Popover open={releaseDateOpen} onOpenChange={setReleaseDateOpen}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className="flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    />
                  }
                >
                  <CalendarIcon className="size-4 text-muted-foreground" />
                  {releaseDate ? (
                    <span>{formatDate(releaseDate)}</span>
                  ) : (
                    <span className="text-muted-foreground">Pick a date</span>
                  )}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={releaseDate}
                    onSelect={(date) => {
                      setReleaseDate(date ?? undefined);
                      setReleaseDateOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Maturity Date */}
            <div className="space-y-2">
              <Label>Maturity Date</Label>
              <div className="flex h-8 items-center rounded-lg border border-input bg-muted/30 px-2.5 text-sm text-muted-foreground">
                {previewMaturity
                  ? formatDate(parseApiDate(previewMaturity) ?? new Date(previewMaturity))
                  : "—"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Card 4: Deductions & Net Proceeds ── */}
      <Card>
        <CardHeader>
          <CardTitle>Deductions & Net Proceeds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Processing Fee */}
            <div className="space-y-2">
              <Label className="flex items-center gap-0.5">
                Processing Fee
                <span className="text-muted-foreground font-normal text-xs ml-0.5">(</span>
                {editingFeeRate === "processing" ? (
                  <input
                    inputMode="decimal"
                    autoFocus
                    className="w-14 border-b border-brand-orange bg-transparent text-center text-xs text-muted-foreground font-normal outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    value={processingFeeRate}
                    onChange={(e) => setProcessingFeeRate(sanitizeDecimalInput(e.target.value))}
                    onBlur={() => setEditingFeeRate(null)}
                    onKeyDown={(e) => { if (e.key === "Enter") setEditingFeeRate(null); }}
                  />
                ) : (
                  <span
                    className="text-xs text-muted-foreground font-normal cursor-pointer hover:text-brand-orange"
                    onClick={() => setEditingFeeRate("processing")}
                    title="Click to edit"
                  >
                    {formatRate(processingFeePercent)}
                  </span>
                )}
                <span className="text-muted-foreground font-normal text-xs">%)</span>
              </Label>
              <Input
                type="text"
                readOnly
                value={currencyOrDash(
                  previewDeductionAmount(previewDeductions?.items, deductions, processingFeeInput),
                )}
                className="bg-muted/40 cursor-default font-medium tabular-nums"
              />
              {processingFeeRange.max > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Allowed range: {processingFeeRange.min}% – {processingFeeRange.max}%
                </p>
              )}
            </div>

            {/* Service Fee */}
            <div className="space-y-2">
              <Label className="flex items-center gap-0.5">
                Service Fee
                <span className="text-muted-foreground font-normal text-xs ml-0.5">(</span>
                {editingFeeRate === "service" ? (
                  <input
                    inputMode="decimal"
                    autoFocus
                    className="w-14 border-b border-brand-orange bg-transparent text-center text-xs text-muted-foreground font-normal outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    value={serviceFeeRate}
                    onChange={(e) => setServiceFeeRate(sanitizeDecimalInput(e.target.value))}
                    onBlur={() => setEditingFeeRate(null)}
                    onKeyDown={(e) => { if (e.key === "Enter") setEditingFeeRate(null); }}
                  />
                ) : (
                  <span
                    className="text-xs text-muted-foreground font-normal cursor-pointer hover:text-brand-orange"
                    onClick={() => setEditingFeeRate("service")}
                    title="Click to edit"
                  >
                    {formatRate(serviceFeePercent)}
                  </span>
                )}
                <span className="text-muted-foreground font-normal text-xs">%)</span>
              </Label>
              <Input
                type="text"
                readOnly
                value={currencyOrDash(
                  previewDeductionAmount(previewDeductions?.items, deductions, serviceFeeInput),
                )}
                className="bg-muted/40 cursor-default font-medium tabular-nums"
              />
              {serviceFeeRange.max > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Allowed range: {serviceFeeRange.min}% – {serviceFeeRange.max}%
                </p>
              )}
            </div>

            {/* Carried fees — the notarial fee: charged, but not editable here */}
            {carriedDeductions.map((d, idx) => (
              <div key={`${d.name}-${idx}`} className="space-y-2">
                <Label className="flex items-center gap-0.5">
                  {d.name}
                  <span className="text-muted-foreground font-normal text-xs ml-0.5">
                    ({formatRate(d.amount)}%)
                  </span>
                </Label>
                <Input
                  type="text"
                  readOnly
                  value={currencyOrDash(previewDeductionAmount(previewDeductions?.items, deductions, d))}
                  className="bg-muted/40 cursor-default font-medium tabular-nums"
                />
                <p className="text-[10px] text-muted-foreground">Set by loan product</p>
              </div>
            ))}
          </div>

            {/* Configured fees the release would add for this loan, from the server */}
            {previewDeductions && previewDeductions.configured_fees.length > 0 && (
              <div className="space-y-2">
                {previewDeductions.configured_fees.map((f) => (
                  <div key={f.fee_id} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{f.name}</span>
                    <span className="text-sm font-medium">{formatCurrency(f.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Other Deductions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Other Deductions</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOtherDeductions((prev) => [...prev, { name: "", amount: "" }])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Deduction
                </Button>
              </div>
              {otherDeductions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No other deductions added.</p>
              ) : (
                <div className="space-y-2">
                  {otherDeductions.map((ded, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        placeholder="Deduction name"
                        value={ded.name}
                        onChange={(e) =>
                          setOtherDeductions((prev) =>
                            prev.map((d, i) => (i === idx ? { ...d, name: e.target.value } : d))
                          )
                        }
                        className="flex-1"
                      />
                      <Input
                        inputMode="decimal"
                        placeholder="Amount"
                        value={ded.amount}
                        onChange={(e) =>
                          setOtherDeductions((prev) =>
                            prev.map((d, i) => (i === idx ? { ...d, amount: sanitizeDecimalInput(e.target.value, PESO_DECIMALS) } : d))
                          )
                        }
                        className="w-32"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setOtherDeductions((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-destructive hover:text-destructive shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          <Separator />

          {/* Summary — the server's totals; a dash until it has sent them */}
          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            aria-live="polite"
            aria-busy={preview.status === "loading"}
          >
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Total Deductions
              </span>
              <span className="text-sm font-semibold">
                {currencyOrDash(previewDeductions?.total_deductions)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-brand-orange/10 px-4 py-3">
              <span className="text-sm font-medium">Net Proceeds</span>
              <span className="text-lg font-bold text-brand-orange">
                {currencyOrDash(previewDeductions?.net_proceeds)}
              </span>
            </div>
          </div>
          {previewDeductions?.error && (
            <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              {previewDeductions.error}
            </p>
          )}
          {preview.status === "error" && (
            <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
              <p className="flex items-center gap-1.5 text-destructive">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                We couldn&rsquo;t load the deductions preview.
              </p>
              <span className="text-xs text-muted-foreground">{preview.message}</span>
              <Button type="button" variant="outline" size="sm" onClick={retryPreview}>
                <RefreshCw className="mr-2 size-4" />
                Retry
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Card 5: Amortization Schedule Preview ── */}
      <Card>
        <CardHeader>
          <CardTitle>Amortization Schedule Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {canShowAmortization && preview.status === "loading" ? (
            <div
              role="status"
              className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
            >
              <Spinner className="size-4" />
              Loading the schedule preview…
            </div>
          ) : canShowAmortization && preview.status === "error" ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
            >
              <AlertCircle
                className="mt-0.5 size-4 shrink-0 text-destructive"
                aria-hidden="true"
              />
              <div className="flex-1 space-y-2">
                <p className="font-medium">
                  We couldn&rsquo;t load the schedule preview.
                </p>
                <p className="text-muted-foreground">{preview.message}</p>
                <Button type="button" variant="outline" size="sm" onClick={retryPreview}>
                  <RefreshCw className="mr-2 size-4" />
                  Retry
                </Button>
              </div>
            </div>
          ) : canShowAmortization && amortization ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Built with the product&rsquo;s{" "}
                {interestMethodLabel(amortization.interest_method)} interest
                method, as the loan&rsquo;s schedule will be at release.
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Principal</TableHead>
                      <TableHead className="text-right">Interest</TableHead>
                      <TableHead className="text-right">Share Capital Build-Up</TableHead>
                      <TableHead className="text-right">Total Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {amortization.rows.map((row) => (
                      <TableRow key={row.period_number}>
                        <TableCell className="text-center">
                          {row.period_number}
                        </TableCell>
                        <TableCell>{formatDate(parseApiDate(row.due_date) ?? new Date(row.due_date))}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.principal_due)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.interest_due)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.share_capital_build_up)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(row.total_payment)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="font-semibold">
                        Total
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(amortization.totals.principal_due)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(amortization.totals.interest_due)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(amortization.totals.share_capital_build_up)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(amortization.totals.total_payment)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <Info className="mb-2 size-8 opacity-50" />
              <p className="text-sm">
                Fill in all required fields above to preview the amortization
                schedule.
              </p>
              <p className="mt-1 text-xs">
                Product, amount, term, interest, frequency, and release date are
                required.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Submit ── */}
      <div className="flex flex-col gap-2 sm:items-end">
        {collateralBlock && (
          <p
            id="save-blocked-reason"
            className="text-sm text-muted-foreground sm:text-right"
          >
            {collateralBlock}
          </p>
        )}
        <Button
          size="lg"
          className="w-full bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark sm:w-auto"
          disabled={submitting || collateralBlock !== null}
          aria-describedby={collateralBlock ? "save-blocked-reason" : undefined}
          onClick={handleSubmit}
        >
          {submitting
            ? isEditMode ? "Saving..." : "Submitting..."
            : isEditMode ? "Save Changes" : "Submit Loan Application"}
        </Button>
      </div>

      {/* ── Collateral Picker Dialog ── */}
      <Dialog
        open={collateralPickerOpen}
        onOpenChange={setCollateralPickerOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Attach Collateral</DialogTitle>
            <DialogDescription>
              Pick from the registered collaterals for{" "}
              <span className="font-medium">
                {selectedBorrower?.full_name ?? "this member"}
              </span>
              . Collaterals already locked to another active loan are
              disabled. Need a new one?{" "}
              <Link
                href={`/collaterals/new${
                  borrowerId ? `?borrower_id=${borrowerId}` : ""
                }`}
                className="text-primary underline"
              >
                Register a collateral
              </Link>
              .
            </DialogDescription>
          </DialogHeader>
          {pickerRows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                This member hasn&rsquo;t registered any collaterals yet.
              </p>
            </div>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {pickerRows.map(({ collateral: c, isSelected, isLocked, isValueUnknown }) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={isSelected || isLocked || isValueUnknown}
                  onClick={() => {
                    setSelectedCollaterals((prev) => [
                      ...prev,
                      {
                        collateral: c,
                        snapshot_value: c.effective_value,
                      },
                    ]);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                    !isSelected &&
                      !isLocked &&
                      !isValueUnknown &&
                      "hover:border-primary/40 hover:bg-muted/40",
                    (isSelected || isLocked || isValueUnknown) && "opacity-60",
                  )}
                >
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {c.type?.name ?? "Unknown"}
                      </Badge>
                      <span className="text-sm font-medium">
                        {c.detail_value}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {isLocked && (
                        <Badge
                          className={
                            c.lock.state === "unknown"
                              ? "bg-muted text-muted-foreground hover:bg-muted"
                              : "bg-amber-500/15 text-amber-700 hover:bg-amber-500/15"
                          }
                          title={holdersSentence(c.lock) ?? undefined}
                        >
                          {lockLabel(c.lock)}
                        </Badge>
                      )}
                      {isSelected && !isLocked && (
                        <Badge variant="outline">Already attached</Badge>
                      )}
                      {c.type?.source === "share_capital" && !isValueUnknown && (
                        <span>Live share-capital balance</span>
                      )}
                      {isValueUnknown && (
                        <span className="text-amber-700 dark:text-amber-500">
                          Share capital ledger unreadable — cannot be attached
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      isValueUnknown && "text-amber-700 dark:text-amber-500",
                    )}
                  >
                    {isValueUnknown
                      ? SHARE_CAPITAL_UNAVAILABLE_LABEL
                      : formatCurrency(c.effective_value)}
                  </span>
                </button>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCollateralPickerOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// Inside the Suspense boundary because edit mode comes from the search params.
// Edit mode opens by reading the loan, so it needs `loans:view` as well. For a
// new application the inner guard just repeats the outer one.
function NewLoanApplicationGuard() {
  const isEditMode = parseEditLoanId(useSearchParams().get("edit")) !== null;
  const pageName = isEditMode ? "Edit Loan Application" : "New Loan Application";
  return (
    <RouteGuard permission={isEditMode ? "loans:update" : "loans:create"} pageName={pageName}>
      <RouteGuard permission={isEditMode ? "loans:view" : "loans:create"} pageName={pageName}>
        <NewLoanApplicationInner />
      </RouteGuard>
    </RouteGuard>
  );
}

export default function NewLoanApplicationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      }
    >
      <NewLoanApplicationGuard />
    </Suspense>
  );
}
