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
 * Rules, each of which is here because the convenient version is wrong:
 *
 *  - **A suggestion is a suggestion.** An `exact_name_match` is pre-selected so
 *    the common case is one click, but it is labelled as something to confirm.
 *    `ambiguous_name` gets NO pre-selection, on purpose: `loan_products.name`
 *    is not unique, so an equally-good second match exists, and picking one
 *    mis-prices an entire cohort with nothing on screen to show for it. (Note
 *    the wire spelling: `ambiguous_name` and `blank_csv_value`, not
 *    `ambiguous`/`blank` — switching on the short form compiles and silently
 *    prints the raw enum at the admin.) The server sends
 *    `suggestion_candidate_ids` in that case, so the tied products are NAMED
 *    rather than left for the admin to hunt for. Every option in the dropdown
 *    carries its rate, method, term and amount range for the same reason — a
 *    name alone cannot tell two products apart.
 *
 *  - **A blank product cell is a real cohort.** The server keys it as `""`,
 *    flags it as `is_blank` and counts its loans like any other. Read the flag;
 *    do not test `csv_value === ""`, because a cell of whitespace is blank to
 *    the server and not to `===`.
 *
 *  - **The server owns the gate.** `mapping_complete` and `unmapped` come off
 *    the response, so the Continue button and the server cannot disagree about
 *    what is outstanding. This screen decides only whether the admin has
 *    answered the server's list — never what belongs on it.
 *
 *  - **Compatibility is disclosed, not enforced, and only where it is real.**
 *    The server measures it against the product a cohort would ACTUALLY land
 *    on — the confirmed mapping, or failing that the suggestion — so an exact
 *    match is checked before anything is confirmed, and a `no_match` has
 *    nothing to check against and reports `null`. Null is "not compared", not
 *    "compared and fine", so it is never rendered as reassurance.
 *    `out_of_bounds` rows are warnings either way:
 *    the importer deliberately bypasses the guards that would reject a new loan
 *    outside a product's limits, because migrated loans are history, not new
 *    business. Calling them errors would suggest a fix that does not exist.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CircleAlert,
  ClipboardCheck,
  Clock,
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
import { formatCount, formatCurrency } from "@/lib/report-format";
import { cn } from "@/lib/utils";
import { dataImportService } from "@/services/data-import.service";
import type {
  CsvProductCompatibility,
  CsvProductMapping,
  LoanProductOption,
  ProductMappingResponse,
} from "@/types/data-import";

/** Sentinel for "not mapped". Product ids are numbers, so it cannot collide. */
const UNMAPPED = "";

/** Where a product is actually created. Never inline on this screen. */
const LOAN_PRODUCTS_HREF = "/settings/loan-products";

export type ProductMappingValue = Record<string, number>;

/** The blank cohort has no name to print, so it needs one everywhere it is
 *  referred to — the table cell, the select's accessible name, the counts. */
const BLANK_LABEL = "(no product named)";

function productLabel(product: CsvProductMapping): string {
  return product.is_blank ? BLANK_LABEL : product.csv_value;
}

/**
 * Stable React key.
 *
 * PREFIXED rather than given a sentinel value: `csv_value` is arbitrary text
 * out of the admin's file, so any bare sentinel is a string the file could
 * legitimately contain. Prefixing puts the blank cohort in its own namespace,
 * where nothing can collide with it.
 */
function productKey(product: CsvProductMapping): string {
  return product.is_blank ? "blank" : `value:${product.csv_value}`;
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export interface ProductMappingTableProps {
  /** Every distinct product string in the file, blank cohort included. */
  csvProducts: readonly CsvProductMapping[];
  loanProducts: readonly LoanProductOption[];
  /** Current selection, keyed by `csv_value` exactly as the server keys it. */
  value: ProductMappingValue;
  onChange: (csvValue: string, productId: number) => void;
  disabled?: boolean;
}

/**
 * The one line that tells two same-named products apart.
 *
 * `loan_products.name` is not unique, which is the whole reason `ambiguous`
 * exists as a suggestion reason. A dropdown showing only names reproduces the
 * ambiguity it was meant to resolve. The amount range is in here because it is
 * one of the two things `compatibility` later measures rows against — better to
 * see it while choosing than to be told afterwards that a cohort fell outside.
 */
function productSummary(product: LoanProductOption): string {
  const parts = [
    `${formatRate(product.interest_rate)}%`,
    product.interest_method,
    `${product.term} × ${product.frequency}`,
  ];
  if (product.min_amount != null && product.max_amount != null) {
    parts.push(`${formatCurrency(product.min_amount)}–${formatCurrency(product.max_amount)}`);
  }
  return parts.join(" · ");
}

function SuggestionNote({
  product,
  loanProducts,
}: {
  product: CsvProductMapping;
  loanProducts: readonly LoanProductOption[];
}) {
  switch (product.suggestion_reason) {
    case "exact_name_match":
      return (
        <Badge variant="outline" className="font-normal">
          Exact name match — confirm
        </Badge>
      );
    case "blank_csv_value":
      return (
        <span className="text-xs text-muted-foreground">
          The Loan Product cell is empty on these rows.
        </span>
      );
    case "ambiguous_name": {
      // Name the products that tied. The server sends their ids precisely so
      // this does not have to be "two products share this name, good luck".
      const candidates = product.suggestion_candidate_ids
        .map((id) => loanProducts.find((option) => option.id === id))
        .filter((option): option is LoanProductOption => option != null);
      return (
        <span className="text-xs text-muted-foreground">
          {candidates.length > 0 ? (
            <>
              Matches {candidates.length} products with this name:{" "}
              {candidates.map((option, index) => (
                <span key={option.id}>
                  {index > 0 && ", "}
                  <span className="font-medium text-foreground">{option.name}</span> (
                  {productSummary(option)})
                </span>
              ))}
              . Pick the right one — the name alone cannot tell them apart.
            </>
          ) : (
            <>
              More than one product has this name. Pick the right one — the name alone cannot tell
              them apart.
            </>
          )}
        </span>
      );
    }
    case "no_match":
      return <span className="text-xs text-muted-foreground">No product with this name.</span>;
    default:
      // Forward-compatible: a reason added server-side still reaches the admin.
      return <span className="text-xs text-muted-foreground">{product.suggestion_reason}</span>;
  }
}

/**
 * The row's own compatibility, once it has one.
 *
 * Present as soon as the cohort has a product to be checked against — confirmed
 * or suggested — so an exact match shows its mismatches while the admin can
 * still choose differently. It names the product actually checked against and
 * says WHICH interest methods in the file disagree with it, rather than only
 * how many rows do.
 */
/**
 * The phrases for one cohort's compatibility, as plain strings.
 *
 * Exported and pure so the wording can be tested against real captured
 * payloads rather than eyeballed. Returns `[]` when the cohort agrees with its
 * product on every count.
 */
export function compatibilityNotes(compatibility: CsvProductCompatibility): string[] {
  const { interest_method, out_of_bounds, rows_unevaluated, rows_not_importable } = compatibility;
  const notes: string[] = [];

  if (interest_method.disagreeing_rows > 0) {
    // Name the offending methods. `csv_interest_types` counts EVERY method
    // present including the agreeing one, so the product's own method is
    // filtered out to leave the ones that actually disagree.
    const offending = Object.entries(interest_method.csv_interest_types)
      .filter(([method]) => method !== interest_method.product_interest_method)
      .map(([method, count]) => `${formatCount(count)} ${method}`);
    notes.push(
      `${formatCount(interest_method.disagreeing_rows)} on a different interest method to ${
        interest_method.product_interest_method
      }${offending.length > 0 ? ` (${offending.join(", ")})` : ""}`,
    );
  }

  if (out_of_bounds.rows > 0) {
    // Both directions matter. An earlier draft of the type carried only the
    // `above_max` half, so a live run that tripped `rate_below_min` reported
    // "1 loan outside its limits" and then had nothing to say about why.
    const facet = (label: string, below: number, above: number) => {
      const parts = [
        below > 0 && `${formatCount(below)} under`,
        above > 0 && `${formatCount(above)} over`,
      ].filter((entry): entry is string => Boolean(entry));
      return parts.length > 0 ? `${label} ${parts.join(", ")}` : null;
    };
    const detail = [
      facet("amount", out_of_bounds.amount_below_min, out_of_bounds.amount_above_max),
      facet("term", out_of_bounds.term_below_min, out_of_bounds.term_above_max),
      facet("rate", out_of_bounds.rate_below_min, out_of_bounds.rate_above_max),
    ].filter((entry): entry is string => entry !== null);
    notes.push(
      `${formatCount(out_of_bounds.rows)} outside the product's limits${
        detail.length > 0 ? ` — ${detail.join("; ")}` : ""
      }`,
    );
  }

  if (rows_unevaluated > 0) {
    notes.push(`${formatCount(rows_unevaluated)} could not be compared`);
  }
  if (rows_not_importable > 0) {
    notes.push(`${formatCount(rows_not_importable)} cannot be imported`);
  }

  return notes;
}

/**
 * The row's own compatibility, once it has one.
 *
 * Present as soon as the cohort has a product to be checked against — confirmed
 * or suggested — so an exact match shows its mismatches while the admin can
 * still choose differently. It names the product actually checked against and
 * says WHICH interest methods in the file disagree with it, rather than only
 * how many rows do.
 */
function RowCompatibility({ compatibility }: { compatibility: CsvProductCompatibility }) {
  const notes = compatibilityNotes(compatibility);

  if (notes.length === 0) {
    return (
      <p className="mt-1 text-xs text-emerald-600">
        Checked against {compatibility.checked_against_loan_product_name} — every loan agrees.
      </p>
    );
  }

  return (
    <p className="mt-1 text-xs text-amber-600">
      Checked against {compatibility.checked_against_loan_product_name}: {notes.join("; ")}.
    </p>
  );
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
      <Table className="min-w-[48rem]">
        <TableCaption className="sr-only">
          Every loan product named in the file, and the Lendyph product it will be imported against
        </TableCaption>
        <TableHeader>
          <TableRow>
            {/* Widest of the three text columns: it carries the name, the
                blank-cohort explainer AND the compatibility sentence, which is
                the longest string on the screen. Sized off that, not off the
                header. */}
            <TableHead className="w-80">In your file</TableHead>
            <TableHead className="w-24 text-right">Loans</TableHead>
            {/* No fixed width: the suggestion copy is the one column that can
                shrink, and pinning it pushed "Import as" off the edge. */}
            <TableHead>Suggestion</TableHead>
            <TableHead className="w-60">Import as</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {csvProducts.map((product) => {
            const selected = value[product.csv_value];
            const label = productLabel(product);
            // Only a blocking row is a problem when it is unanswered. A
            // non-blocking one is offered, not demanded.
            const needsAnswer = product.blocking && selected === undefined;
            return (
              <TableRow key={productKey(product)}>
                <TableCell className="whitespace-normal">
                  {product.is_blank ? (
                    <div>
                      <span className="font-medium text-muted-foreground italic">
                        {BLANK_LABEL}
                      </span>
                      {/* Offered a mapping like any other cohort — the server
                          keys these on "" and will import them. */}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        These loans have an empty Loan Product cell. They still need a product.
                      </p>
                    </div>
                  ) : (
                    <span className="font-medium break-words">{product.csv_value}</span>
                  )}
                  {/* Non-blocking means no row under this name staged valid,
                      so mapping it changes nothing. Saying only "not blocking"
                      reads as permission to ignore a real cohort. */}
                  {!product.blocking && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      None of these loans passed the checks, so this name does not hold up the
                      import — and choosing a product will not rescue them.
                    </p>
                  )}
                  {product.compatibility && (
                    <RowCompatibility compatibility={product.compatibility} />
                  )}
                </TableCell>
                <TableCell className="text-right align-top tabular-nums">
                  <div>{formatCount(product.loan_count)}</div>
                  {/* A name whose loans are ALREADY failing staging is a
                      different problem from one that is merely unmapped, and
                      mapping it will not fix them. Say so here rather than
                      letting the admin discover it in the error report. */}
                  {product.invalid_loan_count > 0 && (
                    <div className="mt-0.5 text-xs text-destructive">
                      {formatCount(product.invalid_loan_count)} with errors
                    </div>
                  )}
                  {product.invalid_loan_count > 0 && product.valid_loan_count > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {formatCount(product.valid_loan_count)} ok
                    </div>
                  )}
                </TableCell>
                {/* `TableCell` is `whitespace-nowrap` by default, which turns
                    a sentence of guidance into a table three screens wide. */}
                <TableCell className="align-top whitespace-normal">
                  <SuggestionNote product={product} loanProducts={loanProducts} />
                </TableCell>
                <TableCell className="align-top">
                  <Select
                    value={selected === undefined ? UNMAPPED : String(selected)}
                    disabled={disabled}
                    onValueChange={(next) => {
                      if (next == null || next === UNMAPPED) return;
                      onChange(product.csv_value, Number(next));
                    }}
                  >
                    <SelectTrigger
                      className={cn("w-full", needsAnswer && "border-amber-500/60")}
                      aria-label={`Lendyph product for ${
                        product.is_blank ? "loans with no product named" : label
                      }`}
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

/**
 * Rows the server had nothing to compare against, because their cohort has no
 * product yet — neither confirmed nor suggested.
 *
 * This is the ordinary state of a `no_match` cohort on a fresh coop, and it is
 * NOT a warning: it resolves the moment the admin picks a product. It is
 * separated out because `totals.rows_not_compared` folds it together with rows
 * whose figures genuinely could not be read, and rendering that sum as one red
 * alert told the admin something was wrong with their file when the only thing
 * "wrong" was that they had not answered the form yet.
 */
export function rowsAwaitingAProduct(csvProducts: readonly CsvProductMapping[]): number {
  return csvProducts.reduce(
    (sum, product) => (product.compatibility === null ? sum + product.loan_count : sum),
    0,
  );
}

/** Rows the server DID try to compare and could not read. Summed from the
 *  per-entry blocks rather than subtracted out of `rows_not_compared`, so it
 *  makes no assumption about how that total is composed. */
export function rowsUnreadable(csvProducts: readonly CsvProductMapping[]): number {
  return csvProducts.reduce(
    (sum, product) => sum + (product.compatibility?.rows_unevaluated ?? 0),
    0,
  );
}

/**
 * The whole-run rollup.
 *
 * `totals` sums the per-entry compatibility blocks, so it only counts cohorts
 * that HAVE a product to be checked against. Rows under an unmapped `no_match`
 * name are not in these numbers at all — which is why the table above stays the
 * detailed view and this is only the headline.
 */
function CompatibilityNotes({
  totals,
  unreadableRows,
}: {
  totals: ProductMappingResponse["totals"];
  unreadableRows: number;
}) {
  const {
    rows_with_interest_method_disagreement: disagreeing,
    rows_outside_product_bounds: outOfBounds,
  } = totals;
  if (disagreeing === 0 && outOfBounds === 0 && unreadableRows === 0) return null;

  return (
    <div className="space-y-3">
      {disagreeing > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="font-medium">
              {formatCount(disagreeing)} {disagreeing === 1 ? "loan carries" : "loans carry"} an
              interest method their product does not
            </p>
            <p className="mt-0.5 text-muted-foreground">
              The file&apos;s figures are what get imported, so these loans will permanently differ
              from their mapped product — including on their disclosure statement. The table below
              names which product each one was checked against.
            </p>
          </div>
        </div>
      )}

      {outOfBounds > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <Info className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="font-medium">
              {formatCount(outOfBounds)} {outOfBounds === 1 ? "loan falls" : "loans fall"} outside
              their product&apos;s amount, term or rate range
            </p>
            <p className="mt-0.5 text-muted-foreground">
              These are not failures. A new loan outside a product&apos;s limits would be rejected,
              but migrated loans are history rather than new business, so the import writes them as
              they are.
            </p>
          </div>
        </div>
      )}

      {unreadableRows > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium">
              {formatCount(unreadableRows)} {unreadableRows === 1 ? "loan was" : "loans were"} not
              compared
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Their rate, amount or term could not be read, so nothing above accounts for them.
              They are counted here rather than reported as agreeing.
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
  /** Called after the mapping saves, with the server's own statement of what
   *  was just committed to. One entry — the server sends one `message`. */
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
 * Two sources, in order:
 *  1. `mapped_loan_product_id` — an answer the admin already CONFIRMED. A
 *     resumed run must render its own answers, not an empty form.
 *  2. An `exact_name_match` suggestion, so the common first pass is one click.
 *
 * `ambiguous` and `no_match` are deliberately left blank. The contract already
 * returns `suggested_loan_product_id: null` for both, so the reason check is
 * belt-and-braces — but it is the rule that matters here, and reading it off
 * the id alone would silently start pre-selecting guesses the day the server
 * starts sending one.
 */
export function initialSelection(csvProducts: readonly CsvProductMapping[]): ProductMappingValue {
  const selection: ProductMappingValue = {};
  for (const product of csvProducts) {
    if (product.mapped_loan_product_id != null) {
      selection[product.csv_value] = product.mapped_loan_product_id;
      continue;
    }
    if (
      product.suggestion_reason === "exact_name_match" &&
      product.suggested_loan_product_id != null
    ) {
      selection[product.csv_value] = product.suggested_loan_product_id;
    }
  }
  return selection;
}

/**
 * How long the server says to wait, out of a 429.
 *
 * The imports endpoints are throttled at FIVE requests a minute — verified
 * live, `x-ratelimit-limit: 5`, and a breach answers `429` with
 * `retry-after: 46` and the body `{"message":"Too Many Attempts."}`. That is a
 * small budget for a screen whose effect fires twice under StrictMode, so a
 * bare "Try again" button spends what is left and fails again. Read the header
 * and say how long instead of inviting a retry that cannot succeed.
 *
 * Returns seconds, or `null` when this is not a throttle response. A 429
 * without the header still returns a number, because the fact of being
 * throttled is the useful part — `RETRY_AFTER_FALLBACK_SECONDS` covers the
 * window Laravel's default limiter uses.
 */
export const RETRY_AFTER_FALLBACK_SECONDS = 60;

export function retryAfterSeconds(error: unknown): number | null {
  const response = (
    error as { response?: { status?: number; headers?: Record<string, unknown> } }
  )?.response;
  if (response?.status !== 429) return null;
  const raw = response.headers?.["retry-after"] ?? response.headers?.["Retry-After"];
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds)
    : RETRY_AFTER_FALLBACK_SECONDS;
}

/**
 * The server's own list of what is still unmapped, out of a 422.
 *
 * Shape verified live: `{message, errors: {product_mapping: [...], unmapped:
 * ["", "Regular Loan"]}}`. Read defensively — this runs in a catch block, where
 * the value is `unknown` and could as easily be a network error.
 */
export function unmappedFromError(error: unknown): string[] | null {
  const errors = (error as { response?: { data?: { errors?: { unmapped?: unknown } } } })?.response
    ?.data?.errors?.unmapped;
  if (!Array.isArray(errors)) return null;
  const values = errors.filter((entry): entry is string => typeof entry === "string");
  return values.length > 0 ? values : null;
}

/**
 * What is still outstanding, per the SERVER's list.
 *
 * `unmapped` is the server's own answer to "what still needs a choice" — and it
 * carries BLOCKING entries only. So this never decides what belongs on that
 * list, only whether the admin has answered each entry on it. That is what
 * keeps the button and the server from disagreeing: the case that slipped
 * through a client-side "mapped rows vs all rows" count is a non-blocking
 * entry, which the client treats as outstanding and the server does not.
 */
export function stillOutstanding(
  unmapped: readonly string[],
  mapping: ProductMappingValue,
): string[] {
  return unmapped.filter((csvValue) => mapping[csvValue] === undefined);
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
  /** Seconds left on a throttle window. `null` when not throttled. */
  const [retryIn, setRetryIn] = useState<number | null>(null);

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
        // Reported immediately: a pre-selected exact match, or an answer the
        // run already carries, is part of the answer — and a caller that only
        // heard about edits would record an empty map for a screen the admin
        // never had to touch.
        onMappingChange?.(initial);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const wait = retryAfterSeconds(error);
        if (wait !== null) {
          setRetryIn(wait);
          setLoadError(
            "This import is being asked for too often. The server limits these requests, so it is refusing for a moment.",
          );
          return;
        }
        setLoadError("We couldn't load the loan products for this import.");
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

  // Tick the throttle window down so the retry becomes available on its own,
  // rather than leaving the admin to guess when the server will relent.
  useEffect(() => {
    if (retryIn === null || retryIn <= 0) return;
    const timer = setTimeout(() => setRetryIn((left) => (left === null ? null : left - 1)), 1000);
    return () => clearTimeout(timer);
  }, [retryIn]);

  const handleChange = useCallback(
    (csvValue: string, productId: number) => {
      setMapping((previous) => {
        const next = { ...previous, [csvValue]: productId };
        onMappingChange?.(next);
        return next;
      });
    },
    [onMappingChange],
  );

  const outstanding = useMemo(
    () => stillOutstanding(data?.unmapped ?? [], mapping),
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
    const waiting = retryIn !== null && retryIn > 0;
    return (
      <div
        role="alert"
        className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6"
      >
        <p className="text-sm">{loadError ?? "No product mapping is available for this import."}</p>
        <Button
          variant="outline"
          disabled={waiting}
          onClick={() => {
            setRetryIn(null);
            setAttempt((n) => n + 1);
          }}
        >
          {waiting ? `Try again in ${retryIn}s` : "Try again"}
        </Button>
      </div>
    );
  }

  // The loans file has not been read yet, so there is nothing to map. An empty
  // table here would read as "no products found", which is a different and
  // much more alarming statement than "not yet".
  if (!data.loans_file_staged) {
    return (
      <div className="flex items-start gap-3 rounded-lg border p-6 text-sm">
        <Clock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="font-medium">Still reading your loans file</p>
          <p className="mt-0.5 text-muted-foreground">
            The loan products in the file can only be listed once the server has read it. This step
            will fill in on its own.
          </p>
        </div>
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
  const answered = data.csv_products.filter(
    (product) => mapping[product.csv_value] !== undefined,
  ).length;
  // Truncation aside, the gate is the server's: either it already considers the
  // mapping complete, or every entry on its `unmapped` list has an answer.
  const complete =
    !data.csv_products_truncated && (data.mapping_complete || outstanding.length === 0);
  const totalLoans = data.csv_products.reduce((sum, product) => sum + product.loan_count, 0);

  const save = async () => {
    setSaving(true);
    try {
      const result = await dataImportService.saveProductMapping(runId, mapping);
      // The PUT hands back a full re-read alongside the message, so the screen
      // refreshes from the write itself — no follow-up GET, and no window where
      // the table shows figures the server has already moved past.
      if (result?.data) setData(result.data);
      // One message, not a list. It is counted off the staged rows, so it says
      // what this admin actually committed to rather than a generic warning
      // assembled on the client.
      onMapped(result?.message ? [result.message] : []);
    } catch (error) {
      // A 422 means the server disagrees about what is outstanding — it names
      // exactly which strings under `errors.unmapped`. Repeating its list beats
      // "please try again", which gives the admin nothing to act on.
      const wait = retryAfterSeconds(error);
      if (wait !== null) {
        setRetryIn(wait);
        toast.error(`Too many requests just now. Try again in about ${wait}s.`);
        return;
      }
      const stillUnmapped = unmappedFromError(error);
      if (stillUnmapped) {
        setData((previous) => (previous ? { ...previous, unmapped: stillUnmapped } : previous));
        toast.error(
          `Still to map: ${stillUnmapped.map((entry) => entry || BLANK_LABEL).join(", ")}`,
        );
      } else {
        toast.error("We couldn't save the product mapping. Please try again.");
      }
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
              A coop has a handful of loan products, not hundreds — this file has at least{" "}
              {formatCount(data.csv_product_string_cap)}. That almost always means the columns are
              shifted, so the list below is values read out of the wrong column — and it is only
              part of the list. Check the Loan Product column in your file and start again; mapping
              this would price the whole loan book off the wrong column.
            </p>
          </div>
        </div>
      )}

      {/* Already confirmed. Said plainly, because the table below is full of
          pre-filled answers and it should be obvious why. */}
      {data.mapping_complete && !data.csv_products_truncated && (
        <div className="flex items-start gap-3 rounded-lg border p-4 text-sm">
          <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <div>
            <p className="font-medium">Every product in this file is mapped</p>
            <p className="mt-0.5 text-muted-foreground">
              These are the choices already confirmed for this import. Changing one and continuing
              saves it again.
            </p>
          </div>
        </div>
      )}

      <CompatibilityNotes totals={data.totals} unreadableRows={rowsUnreadable(data.csv_products)} />

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
            {formatCount(answered)} of {formatCount(total)} mapped
          </span>
          <span className="ml-2 text-muted-foreground">
            {data.csv_products_truncated
              ? "This list is incomplete, so it cannot be finished here."
              : complete
                ? `Covering ${formatCount(totalLoans)} ${totalLoans === 1 ? "loan" : "loans"}.`
                : `${formatCount(outstanding.length)} still to choose.`}
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
