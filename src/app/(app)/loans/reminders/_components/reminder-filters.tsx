"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useBranches } from "@/hooks";
import { CHANNEL_LABELS } from "@/lib/reminders";
import type { ReminderChannel, ReminderListFilters } from "@/types/reminder";
import { useLoanProducts } from "../_hooks/use-loan-products";

/** The filters every reminder list shares; each screen adds its own status. */
type SharedFilters = Omit<ReminderListFilters, "status">;

interface ReminderFiltersProps<F extends SharedFilters> {
  value: F;
  onChange: (next: F) => void;
  /** `day` filters one date (dashboard); `range` a from/to pair (queue, history). */
  dates: "day" | "range";
  /** Screen-specific controls (a status picker) at the end of the row. */
  children?: React.ReactNode;
}

const CHANNELS = Object.keys(CHANNEL_LABELS) as ReminderChannel[];

/** Number from a select value, where "" means "any". */
const idOrUndefined = (v: string) => (v ? Number(v) : undefined);

export function ReminderFilters<F extends SharedFilters>({ value, onChange, dates, children }: ReminderFiltersProps<F>) {
  const { branches } = useBranches();
  const { products, error: productsError } = useLoanProducts();
  const set = (patch: Partial<SharedFilters>) => onChange({ ...value, ...patch, page: 1 });

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      <div className="relative sm:col-span-2 lg:col-span-2 xl:col-span-2">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {/* Commits on Enter or blur, not per keystroke — each change is a
            request. Uncontrolled so typing doesn't need state of its own. */}
        <Input
          aria-label="Search borrower or loan"
          placeholder="Borrower or loan number, then Enter"
          className="pl-8"
          defaultValue={value.search ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") set({ search: e.currentTarget.value.trim() || undefined });
          }}
          onBlur={(e) => {
            const search = e.currentTarget.value.trim() || undefined;
            if (search !== value.search) set({ search });
          }}
        />
      </div>
      {dates === "day" ? (
        <Input
          type="date"
          aria-label="Date"
          value={value.date ?? ""}
          onChange={(e) => set({ date: e.target.value || undefined })}
        />
      ) : (
        <>
          <Input
            type="date"
            aria-label="From"
            value={value.date_from ?? ""}
            onChange={(e) => set({ date_from: e.target.value || undefined })}
          />
          <Input
            type="date"
            aria-label="To"
            value={value.date_to ?? ""}
            onChange={(e) => set({ date_to: e.target.value || undefined })}
          />
        </>
      )}
      <NativeSelect
        aria-label="Branch"
        className="w-full"
        value={value.branch_id ?? ""}
        onChange={(e) => set({ branch_id: idOrUndefined(e.target.value) })}
      >
        <NativeSelectOption value="">All branches</NativeSelectOption>
        {branches.map((b) => (
          <NativeSelectOption key={b.id} value={b.id}>
            {b.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {/* Disabled with the reason as its text when the products can't load,
          rather than an "All products" picker that silently offers nothing. */}
      <NativeSelect
        aria-label="Loan product"
        className="w-full"
        disabled={productsError !== null}
        title={productsError ?? undefined}
        value={value.loan_product_id ?? ""}
        onChange={(e) => set({ loan_product_id: idOrUndefined(e.target.value) })}
      >
        <NativeSelectOption value="">{productsError ? "Products unavailable" : "All products"}</NativeSelectOption>
        {products.map((p) => (
          <NativeSelectOption key={p.id} value={p.id}>
            {p.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Channel"
        className="w-full"
        value={value.channel ?? ""}
        onChange={(e) => set({ channel: (e.target.value || undefined) as ReminderChannel | undefined })}
      >
        <NativeSelectOption value="">All channels</NativeSelectOption>
        {CHANNELS.map((c) => (
          <NativeSelectOption key={c} value={c}>
            {CHANNEL_LABELS[c]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {children}
    </div>
  );
}

/** A status picker for the end of the filter row; "" means any status. */
export function StatusSelect<S extends string>({
  value,
  options,
  onChange,
}: {
  value: S | undefined;
  options: Record<S, { label: string }>;
  onChange: (status: S | undefined) => void;
}) {
  return (
    <NativeSelect
      aria-label="Status"
      className="w-full"
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || undefined) as S | undefined)}
    >
      <NativeSelectOption value="">All statuses</NativeSelectOption>
      {(Object.keys(options) as S[]).map((s) => (
        <NativeSelectOption key={s} value={s}>
          {options[s].label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}
