"use client";

/**
 * The product-mapping gate.
 *
 * Every loan in the file carries a product NAME the coop typed. Lendyph prices
 * a loan off a product ROW — its rate, interest method, term and fees — so
 * until every distinct string in the file points at a real product, the import
 * has nothing to price against. That is why this is a gate and not a form with
 * a "skip" on it.
 *
 * Four rules, each of which is here because the convenient version is wrong:
 *
 *  - **A suggestion is a suggestion.** An `exact_name_match` is pre-selected so
 *    the common case is one click, but it is labelled as something to confirm.
 *    `ambiguous` gets NO pre-selection, on purpose: `loan_products.name` is not
 *    unique, so an equally-good second match exists, and picking one mis-prices
 *    an entire cohort with nothing on screen to show for it. Every option below
 *    is labelled with its rate, method and term for exactly that reason — a
 *    name alone cannot tell two products apart.
 *
 *  - **A blank product cell is a real cohort.** The server keys it as `""` and
 *    counts its loans like any other. Hiding the row because it looks like an
 *    absence of data means that whole cohort fails at import with no warning
 *    here at all.
 *
 *  - **No create-product affordance.** Creating a product from this screen
 *    means inventing its rate, method, term, fees and bounds in a modal, and
 *    those invented numbers then govern every loan imported against it. The
 *    empty state sends the admin to Loan Products to do it properly.
 *
 *  - **Compatibility is disclosed, not enforced.** `out_of_bounds` rows are
 *    warnings: the importer deliberately bypasses the guards that would reject
 *    a new loan outside a product's limits, because migrated loans are history,
 *    not new business. Calling them errors would suggest a fix that does not
 *    exist.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CircleAlert,
  ExternalLink,
  Info,
  PackageSearch,
  ScanSearch,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRate } from "@/lib/format";
import { formatCount } from "@/lib/report-format";
import { cn } from "@/lib/utils";
import { dataImportService } from "@/services/data-import.service";
import type {
  CsvProductMapping,
  LoanProductOption,
  ProductMappingResponse,
} from "@/types/data-import";

/** Sentinel for "not mapped". Product ids are numbers, so it cannot collide. */
const UNMAPPED = "";

/** Where a product is actually created. Never inline on this screen. */
const LOAN_PRODUCTS_HREF = "/settings/loan-products";

export type ProductMappingValue = Record<string, number>;

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export interface ProductMappingTableProps {
  /** Every distinct product string in the file, blank cohort included. */
  csvProducts: readonly CsvProductMapping[];
  loanProducts: readonly LoanProductOption[];
  /** Current selection, keyed by `csv_name` exactly as the server keys it. */
  value: ProductMappingValue;
  onChange: (csvName: string, productId: number) => void;
  disabled?: boolean;
}

/**
 * The one line that tells two same-named products apart.
 *
 * `loan_products.name` is not unique, which is the whole reason `ambiguous`
 * exists as a suggestion reason. A dropdown showing only names reproduces the
 * ambiguity it was meant to resolve.
 */
function productSummary(product: LoanProductOption): string {
  return `${formatRate(product.interest_rate)}% · ${product.interest_method} · ${
    product.term
  } × ${product.frequency}`;
}

function SuggestionNote({ product }: { product: CsvProductMapping }) {
  switch (product.suggestion_reason) {
    case "exact_name_match":
      return (
        <Badge variant="outline" className="font-normal">
          Exact name match — confirm
        </Badge>
      );
    case "ambiguous":
      return (
        <span className="text-xs text-muted-foreground">
          More than one product has this name. Pick the right one — the name alone cannot tell them
          apart.
        </span>
      );
    case "no_match":
      return <span className="text-xs text-muted-foreground">No product with this name.</span>;
    default:
      // Forward-compatible: a reason added server-side still reaches the admin.
      return <span className="text-xs text-muted-foreground">{product.suggestion_reason}</span>;
  }
}

export function ProductMappingTable({
  csvProducts,
  loanProducts,
  value,
  onChange,
  disabled,
}: ProductMappingTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      {/* See the note in precheck-errors-table: scroll rather than squeeze. */}
      <Table className="min-w-[44rem]">
        <TableCaption className="sr-only">
          Every loan product named in the file, and the Lendyph product it will be imported against
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-56">In your file</TableHead>
            <TableHead className="w-20 text-right">Loans</TableHead>
            {/* No fixed width: the suggestion copy is the one column that can
                shrink, and pinning it pushed "Import as" off the edge. */}
            <TableHead>Suggestion</TableHead>
            <TableHead className="w-60">Import as</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {csvProducts.map((product) => {
            const selected = value[product.csv_name];
            const isBlank = product.csv_name === "";
            return (
              <TableRow key={product.csv_name || "(blank)"}>
                <TableCell className="whitespace-normal">
                  {isBlank ? (
                    <div>
                      <span className="font-medium text-muted-foreground italic">
                        (no product named)
                      </span>
                      {/* Offered a mapping like any other cohort — the server
                          keys these on "" and will import them. */}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        These loans have an empty Loan Product cell. They still need a product.
                      </p>
                    </div>
                  ) : (
                    <span className="font-medium break-words">{product.csv_name}</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCount(product.loan_count)}
                </TableCell>
                {/* `TableCell` is `whitespace-nowrap` by default, which turns
                    a sentence of guidance into a table three screens wide. */}
                <TableCell className="whitespace-normal">
                  <SuggestionNote product={product} />
                </TableCell>
                <TableCell>
                  <Select
                    value={selected === undefined ? UNMAPPED : String(selected)}
                    disabled={disabled}
                    onValueChange={(next) => {
                      if (next == null || next === UNMAPPED) return;
                      onChange(product.csv_name, Number(next));
                    }}
                  >
                    <SelectTrigger
                      className={cn("w-full", selected === undefined && "border-amber-500/60")}
                      aria-label={`Lendyph product for ${product.csv_name || "loans with no product named"}`}
                    >
                      {/* The trigger has to be told how to render a value:
                          the items below carry a two-line layout rather than a
                          bare string, and without this it falls back to
                          printing the product id. */}
                      <SelectValue placeholder="Choose a product…">
                        {(raw) =>
                          loanProducts.find((option) => String(option.id) === String(raw))?.name ??
                          "Choose a product…"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {loanProducts.map((option) => (
                        <SelectItem key={option.id} value={String(option.id)}>
                          <span className="flex flex-col items-start">
                            <span>{option.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {productSummary(option)}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compatibility
// ---------------------------------------------------------------------------

function CompatibilityNotes({
  compatibility,
}: {
  compatibility: ProductMappingResponse["compatibility"];
}) {
  const { disagreeing_rows, out_of_bounds, rows_not_importable } = compatibility;
  if (disagreeing_rows === 0 && out_of_bounds.rows === 0 && rows_not_importable === 0) return null;

  const bounds = [
    out_of_bounds.amount_above_max > 0 &&
      `${formatCount(out_of_bounds.amount_above_max)} above the maximum amount`,
    out_of_bounds.term_above_max > 0 &&
      `${formatCount(out_of_bounds.term_above_max)} above the maximum term`,
    out_of_bounds.rate_above_max > 0 &&
      `${formatCount(out_of_bounds.rate_above_max)} above the maximum rate`,
  ].filter((entry): entry is string => Boolean(entry));

  return (
    <div className="space-y-3">
      {disagreeing_rows > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="font-medium">
              {formatCount(disagreeing_rows)}{" "}
              {disagreeing_rows === 1 ? "loan disagrees" : "loans disagree"} with the product they
              are mapped to
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Their rate, interest method or term in the file is not what the product says. The
              file&apos;s figures are what get imported, so these loans will permanently differ from
              their product — and the disclosure statement will show both.
            </p>
          </div>
        </div>
      )}

      {out_of_bounds.rows > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <Info className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="font-medium">
              {formatCount(out_of_bounds.rows)}{" "}
              {out_of_bounds.rows === 1 ? "loan sits" : "loans sit"} outside their product&apos;s
              limits
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {bounds.length > 0 ? `${bounds.join(", ")}. ` : ""}
              These are not failures. A new loan outside a product&apos;s limits would be rejected,
              but migrated loans are history rather than new business, so the import writes them as
              they are.
            </p>
          </div>
        </div>
      )}

      {rows_not_importable > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">
              {formatCount(rows_not_importable)}{" "}
              {rows_not_importable === 1 ? "loan cannot be imported" : "loans cannot be imported"}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Mapping the products will not change this. These rows will be listed in the error
              report once the import finishes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

export interface ProductMappingGateProps {
  /** The run whose staged loans are being mapped. */
  runId: number | string;
  /** Called after the mapping saves, with any warnings the server returned. */
  onMapped: (warnings: string[]) => void;
  /**
   * Called whenever the selection changes, including the initial
   * pre-selection. For a caller that has to carry the map somewhere else — the
   * persisted session records it as `ImportSession.productMap` so a resume does
   * not re-ask. Saving to the server is still this component's job.
   */
  onMappingChange?: (mapping: ProductMappingValue) => void;
  onBack?: () => void;
  /** Label for the confirm button. The step that owns the flow names it. */
  continueLabel?: string;
}

/**
 * Pre-selection rule, in one place.
 *
 * Only an `exact_name_match` is filled in. The contract already returns
 * `suggested_product_id: null` for `ambiguous` and `no_match`, so the reason
 * check is belt-and-braces — but it is the rule that matters here, and reading
 * it off the id alone would silently start pre-selecting guesses the day the
 * server starts sending one.
 */
function initialSelection(csvProducts: readonly CsvProductMapping[]): ProductMappingValue {
  const selection: ProductMappingValue = {};
  for (const product of csvProducts) {
    if (product.suggestion_reason === "exact_name_match" && product.suggested_product_id != null) {
      selection[product.csv_name] = product.suggested_product_id;
    }
  }
  return selection;
}

export function ProductMappingGate({
  runId,
  onMapped,
  onMappingChange,
  onBack,
  continueLabel = "Continue",
}: ProductMappingGateProps) {
  const [data, setData] = useState<ProductMappingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<ProductMappingValue>({});
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    dataImportService
      .productMapping(runId)
      .then((response) => {
        if (cancelled) return;
        setData(response);
        const initial = initialSelection(response.csv_products);
        setMapping(initial);
        // Reported immediately: a pre-selected exact match is part of the
        // answer, and a caller that only heard about edits would record an
        // empty map for a screen the admin never had to touch.
        onMappingChange?.(initial);
      })
      .catch(() => {
        if (!cancelled) setLoadError("We couldn't load the loan products for this import.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `onMappingChange` is deliberately not a dependency: a caller passing an
    // inline arrow would otherwise re-fetch the mapping on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, attempt]);

  const handleChange = useCallback(
    (csvName: string, productId: number) => {
      setMapping((previous) => {
        const next = { ...previous, [csvName]: productId };
        onMappingChange?.(next);
        return next;
      });
    },
    [onMappingChange],
  );

  const mapped = useMemo(
    () => (data?.csv_products ?? []).filter((product) => mapping[product.csv_name] !== undefined),
    [data, mapping],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-6 text-sm text-muted-foreground">
        <Spinner className="size-4" aria-hidden="true" />
        Reading the loan products in your file…
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
        <p className="text-sm">{loadError ?? "No product mapping is available for this import."}</p>
        <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </Button>
      </div>
    );
  }

  // Nothing to map against. Deliberately a signpost, not a create form.
  if (data.loan_products.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageSearch aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No loan products to import against</EmptyTitle>
          <EmptyDescription>
            Every imported loan is priced by a loan product — its rate, interest method, term and
            fees. Set those up first so the loans in your file land on the right terms; creating one
            here would mean inventing numbers that then govern every loan you import.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link href={LOAN_PRODUCTS_HREF} />}>
            Go to Loan Products
            <ExternalLink aria-hidden="true" />
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const total = data.csv_products.length;
  const complete = mapped.length === total && !data.csv_products_truncated;
  const totalLoans = data.csv_products.reduce((sum, product) => sum + product.loan_count, 0);

  const save = async () => {
    setSaving(true);
    try {
      const result = await dataImportService.saveProductMapping(runId, mapping);
      onMapped(result?.warnings ?? []);
    } catch {
      toast.error("We couldn't save the product mapping. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* The server capped the distinct product strings. That is not a display
          problem — it means the column being read is not the product column. */}
      {data.csv_products_truncated && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <ScanSearch className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">This file has too many different loan products to be real</p>
            <p className="mt-0.5 text-muted-foreground">
              A coop has a handful of loan products, not hundreds. This many distinct values almost
              always means the columns are shifted, so the list below is values read out of the
              wrong column — and it is only part of the list. Check the Loan Product column in your
              file and start again; mapping this would price the whole loan book off the wrong
              column.
            </p>
          </div>
        </div>
      )}

      <CompatibilityNotes compatibility={data.compatibility} />

      <ProductMappingTable
        csvProducts={data.csv_products}
        loanProducts={data.loan_products}
        value={mapping}
        onChange={handleChange}
        disabled={saving}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm">
          <span className={cn("font-medium tabular-nums", !complete && "text-amber-600")}>
            {formatCount(mapped.length)} of {formatCount(total)} mapped
          </span>
          <span className="ml-2 text-muted-foreground">
            {complete
              ? `Covering ${formatCount(totalLoans)} ${totalLoans === 1 ? "loan" : "loans"}.`
              : data.csv_products_truncated
                ? "This list is incomplete, so it cannot be finished here."
                : `${formatCount(total - mapped.length)} still to choose.`}
          </span>
        </p>

        <div className="flex gap-2">
          {onBack && (
            <Button variant="outline" onClick={onBack} disabled={saving}>
              Back
            </Button>
          )}
          <Button onClick={save} disabled={!complete || saving}>
            {saving && <Spinner className="size-4" aria-hidden="true" />}
            {continueLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
