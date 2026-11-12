"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { RouteGuard } from "@/components/common";
import { usePermission } from "@/hooks";
// Deep import, not the barrel: re-exporting this one costs every page that
// imports `@/components/common` ~52 kB it cannot use. See the note in the barrel.
import { SubjectPicker } from "@/components/common/subject-picker";
import { LoanSubjectPicker } from "./_components/loan-subject-picker";
import { SavingsSubjectPicker } from "./_components/savings-subject-picker";
import { fetchReceiptPage, type ReceiptOption } from "./_lib/receipt-search";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SearchPicker } from "@/components/common/search-picker";
import { searchEmptyMessage, searchStatus, useSearchPage } from "@/hooks/use-search-page";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronRight, FileStack, Loader2, Printer } from "lucide-react";
import { repaymentService } from "@/services";
import { PrintableRefusedError, visiblePrintables } from "@/lib/printables/catalog";
import { SUBJECT_ACCENT, SUBJECT_META } from "@/lib/printables/types";
import { applyPrintChrome, resolvePrintableOrg } from "@/lib/printables/print-chrome";
import { openPrintable } from "@/lib/printables/print-open";

/**
 * Pick a subject, open the document. There is no on-screen preview on purpose —
 * the print window IS the preview, rendered by the same `renderPrintable` the
 * paper comes off, so what a member signs is what staff saw.
 */

export default function PrintableDetailPage() {
  const params = useParams();
  const router = useRouter();
  const printableId = params?.printableId as string | undefined;
  const { can } = usePermission();
  // A document this deployment or user can't open answers "not found", the
  // same as an unknown id, so its data is never requested.
  const catalog = visiblePrintables(can);
  const printable = catalog.find((p) => p.id === printableId);

  const [subjectId, setSubjectId] = useState<number | null>(null);
  // Only the loan picker uses this — it selects the member first — but it is
  // held here so the empty state below knows to get out of the table's way.
  const [borrowerId, setBorrowerId] = useState<number | null>(null);
  const [opening, setOpening] = useState(false);

  if (!printable) {
    return (
      <RouteGuard permission="reports:view" pageName="Documents">
        <div className="max-w-xl mx-auto py-16 text-center space-y-3">
          <h1 className="text-xl font-semibold">Document not found</h1>
          <p className="text-sm text-muted-foreground">
            The document you&apos;re looking for doesn&apos;t exist or has been
            moved.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/printables")}
            className="mt-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Documents
          </Button>
        </div>
      </RouteGuard>
    );
  }

  const Icon = printable.icon;
  const accent = SUBJECT_ACCENT[printable.subject];
  const subjectLabel = SUBJECT_META[printable.subject].label;
  async function handleOpen() {
    if (!printable || !subjectId) return;
    setOpening(true);
    try {
      // Letterhead is resolved per open rather than held in state: branding can
      // change under a long-lived session, and the store's shared in-flight
      // fetch makes the repeat calls free.
      const org = await resolvePrintableOrg();
      const doc = applyPrintChrome(await printable.build({ subjectId, org }));

      switch (openPrintable(doc)) {
        case "opened":
          // See `usePrintables`: an asserting document whose record could not
          // be read opens as a blank form, and says so rather than reporting
          // success.
          if (doc.incomplete) {
            toast.warning(
              `${printable.title} opened, but its record couldn't be loaded — the figures are blank. Check the details before issuing it.`
            );
          } else {
            toast.success(`${printable.title} opened in a new tab.`);
          }
          break;
        case "popup_blocked":
          toast.error("Allow pop-ups for this site to print the document.");
          break;
        case "unavailable":
          toast.error("This browser can't open the document for printing.");
          break;
      }
    } catch (err) {
      // A record the server refused (a 422) says why; anything else broke the open.
      toast.error(
        err instanceof PrintableRefusedError
          ? err.message
          : "We couldn't prepare the document. Please try again."
      );
    } finally {
      setOpening(false);
    }
  }

  return (
    <RouteGuard permission="reports:view" pageName="Documents">
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/printables" className="hover:text-foreground transition-colors">
            Documents
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">{printable.title}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ring-1",
                accent.bg,
                accent.ring
              )}
            >
              <Icon className={cn("h-6 w-6", accent.text)} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                By {subjectLabel}
              </p>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5">
                {printable.title}
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                {printable.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={() => router.push("/printables")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              All Documents
            </Button>
            <Button
              onClick={handleOpen}
              disabled={!subjectId || opening}
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            >
              {opening ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing…
                </>
              ) : (
                <>
                  <Printer className="mr-2 h-4 w-4" />
                  Open &amp; Print
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Subject picker */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            {printable.subject === "loan" ? (
              // Two steps, not one: the member by name, then their loan off a
              // table. See `LoanSubjectPicker`.
              <LoanSubjectPicker
                borrowerId={borrowerId}
                onBorrowerChange={setBorrowerId}
                value={subjectId}
                onChange={setSubjectId}
              />
            ) : (
              <div className="flex flex-wrap items-end gap-4">
                {printable.subject === "repayment" ? (
                  <RepaymentPicker value={subjectId} onChange={setSubjectId} />
                ) : printable.subject === "savings_account" ||
                  printable.subject === "savings_withdrawal" ||
                  printable.subject === "time_deposit" ? (
                  <SavingsSubjectPicker
                    key={printable.subject}
                    subject={printable.subject}
                    value={subjectId}
                    onChange={setSubjectId}
                  />
                ) : (
                  <SubjectPicker
                    subject={printable.subject}
                    value={subjectId}
                    onChange={setSubjectId}
                  />
                )}

                {!subjectId && (
                  <p className="text-xs text-muted-foreground pb-2">
                    Select a {subjectLabel.toLowerCase()} to open this document.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* The loan table is the guidance once a member is chosen — repeating
            "choose a loan above" under it would only push it off the fold. */}
        {!(printable.subject === "loan" && borrowerId) && (
          <EmptyState title={printable.title} subjectLabel={subjectLabel} count={catalog.length} />
        )}
      </div>
    </RouteGuard>
  );
}

// ---------------------------------------------------------------------------
// Repayment picker
//
// Lives here rather than in `components/common/subject-picker.tsx`: that
// component is shared with Reports, which has no repayment-scoped report, and
// widening its union would make every caller handle a case it cannot produce.
// ---------------------------------------------------------------------------

const fetchReceipts = (query: string) => fetchReceiptPage(repaymentService.listPage, query);

/**
 * Searches the server as you type, 25 rows at a time. The chosen receipt stays
 * shown whatever the search has moved on to. Payments need `payments:view`,
 * which the documents screen does not; without it the picker is locked.
 */
function RepaymentPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const canListPayments = usePermission().can("payments:view");
  const [everOpened, setEverOpened] = useState(false);
  const [chosen, setChosen] = useState<ReceiptOption | null>(null);
  const { query, setQuery, reset, rows, view } = useSearchPage({
    enabled: canListPayments && everOpened,
    fetchPage: fetchReceipts,
  });
  const selected = chosen?.id === value ? chosen : null;

  return (
    <div className="space-y-1">
      <Label className="text-xs">Payment</Label>
      <SearchPicker
        valueLabel={selected?.label ?? null}
        selectedId={selected?.id ?? null}
        placeholder={SUBJECT_META.repayment.placeholder}
        searchPlaceholder="Search receipt, member or loan account..."
        disabled={!canListPayments}
        search={{ query, setQuery, reset }}
        rows={rows}
        renderRow={(item) => (
          <div className="flex flex-col min-w-0">
            <span className="truncate">{item.label}</span>
            {item.hint && (
              <span className="text-xs text-muted-foreground truncate">{item.hint}</span>
            )}
          </div>
        )}
        pending={view.pending}
        status={searchStatus(view, { plural: "payments", firstHint: "a receipt number" })}
        emptyMessage={searchEmptyMessage(view, "payment")}
        onPick={(item) => {
          const next = item.id === selected?.id ? null : item;
          setChosen(next);
          onChange(next?.id ?? null);
        }}
        onOpen={() => setEverOpened(true)}
        aria-label="Payment"
        className="h-9 w-72"
      />
    </div>
  );
}

function EmptyState({
  title,
  subjectLabel,
  count,
}: {
  title: string;
  subjectLabel: string;
  count: number;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 py-16 px-6">
      <div className="max-w-md mx-auto text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full bg-brand-orange/10 flex items-center justify-center">
          <FileStack className="h-6 w-6 text-brand-orange" />
        </div>
        <h3 className="text-base font-semibold">Ready to print {title}</h3>
        <p className="text-sm text-muted-foreground">
          Choose a {subjectLabel.toLowerCase()} above, then{" "}
          <span className="font-medium text-foreground">Open &amp; Print</span>.
          The document opens in a new tab with your cooperative&apos;s letterhead
          and its own print button.
        </p>
        <p className="text-xs text-muted-foreground/80">
          {count} documents are available from the catalog.
        </p>
      </div>
    </div>
  );
}
