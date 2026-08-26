"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { RouteGuard } from "@/components/common";
import { useAuth } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowLeft, ChevronRight, FileStack, Loader2, Printer } from "lucide-react";
import { repaymentService } from "@/services";
import { SubjectPicker } from "../../reports/_components/subject-picker";
import { PRINTABLE_CATALOG, findPrintable } from "@/lib/printables/catalog";
import { SUBJECT_META } from "@/lib/printables/types";
import { applyPrintChrome, resolvePrintableOrg } from "@/lib/printables/print-chrome";
import { openPrintable } from "@/lib/printables/print-open";

/**
 * Pick a subject, open the document. There is no on-screen preview on purpose —
 * the print window IS the preview, rendered by the same `renderPrintable` the
 * paper comes off, so what a member signs is what staff saw.
 */

const SUBJECT_ACCENT = {
  loan: { text: "text-blue-600", bg: "bg-blue-50", ring: "ring-blue-200" },
  borrower: { text: "text-purple-600", bg: "bg-purple-50", ring: "ring-purple-200" },
  repayment: { text: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200" },
} as const;

export default function PrintableDetailPage() {
  const params = useParams();
  const router = useRouter();
  const printableId = params?.printableId as string | undefined;
  const printable = useMemo(() => findPrintable(printableId), [printableId]);

  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [opening, setOpening] = useState(false);
  const { user } = useAuth();

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
  // Every document is issued BY a branch, and the one issuing it is the branch
  // of the person printing it — the subject pickers carry no branch of their own.
  const branchLabel = user?.branch?.name ?? null;

  async function handleOpen() {
    if (!printable || !subjectId) return;
    setOpening(true);
    try {
      // Letterhead is resolved per open rather than held in state: branding can
      // change under a long-lived session, and the store's shared in-flight
      // fetch makes the repeat calls free.
      const org = await resolvePrintableOrg(branchLabel);
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
    } catch {
      toast.error("We couldn't prepare the document. Please try again.");
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
            <div className="flex flex-wrap items-end gap-4">
              {printable.subject === "repayment" ? (
                <RepaymentPicker value={subjectId} onChange={setSubjectId} />
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
          </CardContent>
        </Card>

        <EmptyState title={printable.title} subjectLabel={subjectLabel} />
      </div>
    </RouteGuard>
  );
}

// ---------------------------------------------------------------------------
// Repayment picker
//
// Lives here rather than in `reports/_components/subject-picker.tsx`: that
// component is shared with Reports, which has no repayment-scoped report, and
// widening its union would make every caller handle a case it cannot produce.
// ---------------------------------------------------------------------------

interface RepaymentOption {
  id: number;
  label: string;
  hint?: string;
}

/** The fields `RepaymentResource` sends that the `Repayment` type omits. */
interface RepaymentListRow {
  id: number;
  receipt_number?: string;
  borrower_name?: string;
  loan_account_number?: string;
  amount_paid?: number;
  payment_date?: string;
  status?: string;
}

function RepaymentPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [options, setOptions] = useState<RepaymentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    repaymentService
      // One generous page, filtered in the browser — the same trade-off
      // `SubjectPicker` makes, and the same reason: no debounce, no request
      // per keystroke.
      .listAll({ per_page: 200 })
      .then((res) => {
        if (cancelled) return;
        const rows = (res?.data ?? []) as unknown as RepaymentListRow[];
        setOptions(
          rows.map((row) => ({
            id: row.id,
            label: row.receipt_number ?? `Payment #${row.id}`,
            hint: [
              row.borrower_name,
              row.amount_paid !== undefined ? formatCurrency(row.amount_paid) : null,
              row.payment_date ? formatDate(row.payment_date) : null,
              // A voided payment is still printable — as a VOID receipt — so
              // it stays in the list, but it is labelled before it is chosen.
              row.status === "voided" ? "VOID" : null,
            ]
              .filter(Boolean)
              .join(" · "),
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load payments.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value]
  );

  return (
    <div className="space-y-1">
      <Label className="text-xs">Payment</Label>
      <Combobox
        items={options}
        value={selected}
        onValueChange={(item: RepaymentOption | null) => onChange(item?.id ?? null)}
        itemToStringLabel={(item: RepaymentOption) => item.label}
      >
        <ComboboxInput
          placeholder={
            loading
              ? "Loading payments…"
              : (error ?? SUBJECT_META.repayment.placeholder)
          }
          disabled={loading || !!error}
          showClear
          className="h-9 w-72"
        />
        <ComboboxContent>
          <ComboboxEmpty>No payment found.</ComboboxEmpty>
          <ComboboxList>
            {(item: RepaymentOption) => (
              <ComboboxItem key={item.id} value={item}>
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{item.label}</span>
                  {item.hint && (
                    <span className="text-xs text-muted-foreground truncate">
                      {item.hint}
                    </span>
                  )}
                </div>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}

function EmptyState({
  title,
  subjectLabel,
}: {
  title: string;
  subjectLabel: string;
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
          {PRINTABLE_CATALOG.length} documents are available from the catalog.
        </p>
      </div>
    </div>
  );
}
