"use client";

import { useCallback, useState } from "react";
import { Search, X } from "lucide-react";
import { useApiResource, type ApiResource } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { savingsAccountService } from "@/services/savings-account.service";
import type { SavingsAccount } from "@/types/savings";
import { ACCOUNT_STATUS_LABEL, ACCOUNT_STATUS_TONE } from "../_lib/account-status";
import { AccountBalanceCard } from "./account-balance-card";
import { ToneBadge } from "./tone-badge";

/** Matches shown per search; refine the search rather than page through. */
const MATCHES = 10;

interface AccountLookupProps {
  id: string;
  label: string;
  value: number | null;
  onChange: (id: number | null) => void;
  /** The chosen account and its read, from `useSavingsAccount(value)`. */
  account: SavingsAccount | null;
  resource: ApiResource<SavingsAccount | null>;
  /** Hide an account from the matches, e.g. the transfer's other side. */
  excludeId?: number | null;
  disabled?: boolean;
}

/**
 * Find a savings account by number or member name (a server search, run on
 * Enter or the button), then show its status and balances.
 */
export function AccountLookup({
  id,
  label,
  value,
  onChange,
  account,
  resource,
  excludeId,
  disabled,
}: AccountLookupProps) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");

  const fetcher = useCallback(
    () => savingsAccountService.list({ search: query, per_page: MATCHES }),
    [query],
  );
  const matches = useApiResource(fetcher, value === null && query !== "");
  const rows = matches.loading ? [] : (matches.data?.data ?? []).filter((a) => a.id !== excludeId);
  const more = !matches.loading && (matches.data?.meta.total ?? 0) > MATCHES;

  if (value !== null) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          <Button variant="ghost" size="sm" onClick={() => onChange(null)} disabled={disabled}>
            <X className="mr-1 h-3.5 w-3.5" />
            Change
          </Button>
        </div>
        {account ? (
          <AccountBalanceCard account={account} />
        ) : resource.loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <p className="rounded-md border p-3 text-sm text-destructive">
            {resource.unavailable ? "Savings accounts aren't connected yet." : "We couldn't load this account."}
          </p>
        )}
      </div>
    );
  }

  const search = () => setQuery(text.trim());

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} <span className="text-destructive">*</span>
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          placeholder="Account number or member name"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          disabled={disabled}
        />
        <Button variant="outline" onClick={search} disabled={disabled || !text.trim()} aria-label="Search accounts">
          <Search className="h-4 w-4" />
        </Button>
      </div>
      {query !== "" && (
        <div className="rounded-md border">
          {matches.loading ? (
            <Skeleton className="h-16 w-full" />
          ) : matches.unavailable ? (
            <p className="p-3 text-sm text-muted-foreground">Savings accounts aren&apos;t connected yet.</p>
          ) : matches.error ? (
            <p className="p-3 text-sm text-destructive">We couldn&apos;t search accounts.</p>
          ) : rows.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No account matches &ldquo;{query}&rdquo;.</p>
          ) : (
            <ul className="divide-y">
              {rows.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => onChange(a.id)}
                  >
                    <span className="min-w-0">
                      <span className="block font-mono">{a.account_number}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {a.member.full_name} · {a.product.name}
                      </span>
                    </span>
                    <ToneBadge tone={ACCOUNT_STATUS_TONE[a.status]}>{ACCOUNT_STATUS_LABEL[a.status]}</ToneBadge>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {more && (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              Showing the first {MATCHES} matches. Type more of the number or name to narrow them.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
