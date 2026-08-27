"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { notifyError } from "@/lib/notify";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { collateralLock, holdersSentence, isLocked } from "@/lib/collateral-lock";
import { Check, ChevronsUpDown, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { borrowerService } from "@/services/borrower.service";
import {
  collateralService,
  collateralTypeService,
} from "@/services";
import { getShareCapitalBalance } from "@/utils/share-capital";
import { formatCurrency } from "@/utils/format";
import type { Borrower, Collateral, CollateralType } from "@/types";

interface Props {
  initial?: Collateral;
  mode: "create" | "edit";
}

export function CollateralForm({ initial, mode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetBorrowerId = searchParams.get("borrower_id");

  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [types, setTypes] = useState<CollateralType[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [borrowerId, setBorrowerId] = useState<number | null>(
    initial?.borrower_id ??
      (presetBorrowerId ? Number(presetBorrowerId) : null),
  );
  const [borrowerOpen, setBorrowerOpen] = useState(false);
  const [typeId, setTypeId] = useState<number | null>(
    initial?.collateral_type_id ?? null,
  );
  const [detailValue, setDetailValue] = useState(initial?.detail_value ?? "");
  const [amount, setAmount] = useState<string>(
    initial ? String(initial.amount ?? 0) : "",
  );
  const [scBalance, setScBalance] = useState<number | null>(null);
  const [scBalanceLoading, setScBalanceLoading] = useState(false);
  // Set only when the member drain gave up with pages outstanding, i.e. the
  // owner picker below is knowingly missing people. Null means complete.
  const [memberShortfall, setMemberShortfall] = useState<{
    shown: number;
    total: number | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // members_only: keeps pending/rejected applicants out of the owner picker.
    // Drained across pages rather than asked for in one `per_page: 9999` gulp:
    // BorrowerController clamps that to 100 silently, so on a co-op with more
    // than 100 members the picker simply had no entry for the rest — which
    // reads as "that member is not registered", not as a bug.
    Promise.all([
      borrowerService.listAll({ members_only: 1 }),
      collateralTypeService.list(),
    ])
      .then(([memberDrain, tRes]) => {
        if (cancelled) return;
        setBorrowers(memberDrain.rows);
        setMemberShortfall(
          memberDrain.truncated
            ? { shown: memberDrain.rows.length, total: memberDrain.total }
            : null,
        );
        setTypes(tRes.filter((t) => t.is_visible));
      })
      .catch(() => {
        if (!cancelled) toast.error("We couldn't load the form data. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Lock state of the record being edited, straight off `GET /collaterals/{id}`.
   *
   * Editing an amount here rewrites the appraised value of security a live loan
   * is relying on. The attached loan keeps its own `snapshot_value`, so the
   * change does not retroactively move that loan's security status — but it does
   * change what every later attach and every valuation screen reads, and the
   * operator should know a live loan is involved before they touch it. Create
   * mode has no record yet, so there is nothing to report.
   */
  const initialLock = useMemo(
    () => (mode === "edit" && initial ? collateralLock(initial) : null),
    [mode, initial],
  );

  const selectedBorrower = useMemo(
    () => borrowers.find((b) => b.id === borrowerId) ?? null,
    [borrowers, borrowerId],
  );

  const selectedType = useMemo(
    () => types.find((t) => t.id === typeId) ?? null,
    [types, typeId],
  );

  const isShareCapital = selectedType?.source === "share_capital";

  // Guard against NaN/undefined balances reaching the formatter (which
  // produces the "-₱NaN" display bug).
  const safeScBalance = Number.isFinite(scBalance)
    ? (scBalance as number)
    : 0;

  // When share-capital type is selected and borrower is known, fetch the balance.
  useEffect(() => {
    if (!isShareCapital || !borrowerId) {
      setScBalance(null);
      return;
    }
    let cancelled = false;
    setScBalanceLoading(true);
    getShareCapitalBalance(borrowerId).then((bal) => {
      if (cancelled) return;
      const clean = Number.isFinite(bal) ? bal : 0;
      setScBalance(clean);
      setAmount(String(clean));
      setScBalanceLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isShareCapital, borrowerId]);

  const numericAmount = Number(amount);
  const canSubmit =
    borrowerId !== null &&
    typeId !== null &&
    detailValue.trim().length > 0 &&
    !Number.isNaN(numericAmount) &&
    numericAmount > 0;

  // Normalize a detail value (cert no., title no., plate, etc.) for duplicate
  // comparison: trim + collapse whitespace + uppercase. Different cashiers
  // tend to enter the same reference with random spacing or case.
  const normalizeDetail = (s: string) =>
    s.trim().replace(/\s+/g, " ").toUpperCase();

  const handleSubmit = async () => {
    if (!canSubmit || !borrowerId || !typeId) return;
    setSubmitting(true);
    try {
      // Duplicate guard — prevent registering the same (member, type, detail)
      // pair twice. Skips the current record when editing.
      const existing = await collateralService.list({ borrower_id: borrowerId });
      const target = normalizeDetail(detailValue);
      const dup = existing.find(
        (c) =>
          c.collateral_type_id === typeId &&
          normalizeDetail(c.detail_value) === target &&
          (mode !== "edit" || c.id !== initial?.id),
      );
      if (dup) {
        const memberName = selectedBorrower?.full_name ?? "this member";
        const typeName = selectedType?.name ?? "this type";
        toast.error(
          `${memberName} already has a ${typeName} registered with this ${selectedType?.detail_field_label?.toLowerCase() ?? "reference"}.`,
        );
        setSubmitting(false);
        return;
      }

      const payload = {
        borrower_id: borrowerId,
        collateral_type_id: typeId,
        detail_value: detailValue.trim(),
        amount: numericAmount,
      };
      if (mode === "create") {
        await collateralService.create(payload);
        toast.success("Collateral registered");
      } else if (initial) {
        await collateralService.update(initial.id, payload);
        toast.success("Collateral updated");
      }
      router.push("/collaterals");
    } catch (err) {
      notifyError(err, "We couldn't save this collateral. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Spinner className="size-6" />
            <p className="text-sm">Loading form…</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b border-border/60">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-orange/10 text-brand-orange">
            <Shield className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <CardTitle className="text-base">
              {mode === "create" ? "Collateral details" : "Edit collateral"}
            </CardTitle>
            <CardDescription>
              Fields marked <span className="text-destructive">*</span> are
              required.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {initialLock && isLocked(initialLock) && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4"
          >
            <Shield
              className="mt-0.5 size-5 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <div className="text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                {initialLock.state === "unknown"
                  ? "This collateral's lock state could not be confirmed"
                  : "This collateral is securing an active loan"}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {holdersSentence(initialLock)} Editing its appraised value here
                does not change what that loan was booked at, but it does change
                what every later valuation reads.
              </p>
            </div>
          </div>
        )}

        {memberShortfall && (
          <IncompleteListNotice
            shown={memberShortfall.shown}
            total={memberShortfall.total}
            noun="members"
            consequence="Some members are missing from the picker below and cannot be selected."
          />
        )}

        {/* ── Section: Member ─────────────────────────────────────── */}
        <div className="space-y-2">
          <Label htmlFor="collateral-member">
            Member <span className="text-destructive">*</span>
          </Label>
          <Popover open={borrowerOpen} onOpenChange={setBorrowerOpen}>
            <PopoverTrigger
              render={
                <button
                  id="collateral-member"
                  type="button"
                  role="combobox"
                  aria-expanded={borrowerOpen}
                  className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-sm transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-input/30"
                />
              }
            >
              <span
                className={cn(
                  "truncate text-left",
                  !selectedBorrower && "text-muted-foreground",
                )}
              >
                {selectedBorrower
                  ? selectedBorrower.full_name
                  : "Search member…"}
              </span>
              <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
            </PopoverTrigger>
            <PopoverContent className="w-(--anchor-width) p-0" align="start">
              <Command>
                <CommandInput placeholder="Type a name to search…" />
                <CommandList>
                  <CommandEmpty>No member found.</CommandEmpty>
                  <CommandGroup>
                    {borrowers.map((b) => (
                      <CommandItem
                        key={b.id}
                        value={`${b.full_name} ${b.borrower_code}`}
                        onSelect={() => {
                          setBorrowerId(b.id === borrowerId ? null : b.id);
                          setBorrowerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            borrowerId === b.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span>
                          {b.full_name}{" "}
                          <span className="text-muted-foreground">
                            ({b.borrower_code})
                          </span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* ── Section: Type ───────────────────────────────────────── */}
        <div className="space-y-2">
          <Label htmlFor="collateral-type">
            Collateral Type <span className="text-destructive">*</span>
          </Label>
          <Select
            value={typeId ? String(typeId) : ""}
            onValueChange={(v) => setTypeId(Number(v))}
          >
            <SelectTrigger id="collateral-type" className="h-10">
              {/* Base UI's <Select.Value> renders the raw selected `value`
                  (the id) by default — pass a children render fn so we
                  display the human-readable type name instead of "3". */}
              <SelectValue placeholder="Select a type">
                {(value) => {
                  if (!value) return "Select a type";
                  const t = types.find((x) => String(x.id) === String(value));
                  return t?.name ?? String(value);
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!selectedType && (
            <p className="text-xs text-muted-foreground">
              Choose a type to see the relevant fields.
            </p>
          )}
        </div>

        {/* ── Section: Type-specific details ──────────────────────── */}
        {selectedType && (
          <div className="space-y-6 rounded-lg border border-dashed border-border/70 bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {selectedType.name} details
            </p>

            {/* Detail value */}
            <div className="space-y-2">
              <Label htmlFor="collateral-detail">
                {selectedType.detail_field_label}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="collateral-detail"
                className="h-10"
                value={detailValue}
                onChange={(e) => setDetailValue(e.target.value)}
                placeholder={`Enter ${selectedType.detail_field_label.toLowerCase()}`}
              />
            </div>

            {/* Amount — manual or share-capital-derived */}
            <div className="space-y-2">
              <Label htmlFor="collateral-amount">
                {selectedType.amount_field_label}{" "}
                {!isShareCapital && (
                  <span className="text-destructive">*</span>
                )}
              </Label>
              {isShareCapital ? (
                <div className="rounded-lg border bg-background px-3 py-2.5">
                  {!borrowerId ? (
                    <p className="text-sm text-muted-foreground">
                      Pick a member to see their share capital balance.
                    </p>
                  ) : scBalanceLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading balance…
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        Total share balance (auto-derived)
                      </p>
                      <p className="text-xl font-semibold text-brand-orange tabular-nums">
                        {formatCurrency(safeScBalance)}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <Input
                  id="collateral-amount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  className="h-10 tabular-nums"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              )}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-end gap-2 border-t border-border/60 bg-muted/20 px-6 py-4">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/collaterals" />}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="min-w-[160px]"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Register Collateral" : "Save Changes"}
        </Button>
      </CardFooter>
    </Card>
  );
}
