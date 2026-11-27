"use client";

import { useCallback, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiResource } from "@/hooks";
import { savingsService } from "@/services";
import { OptionSelect } from "../../_components/option-select";

/**
 * Find an open (not closed) regular savings account on the server (account number, member
 * name or code), then pick it. 25 rows at a time; the server lists only the
 * caller's branches.
 */
export function AccountPicker({ id, value, onChange }: { id: string; value: string; onChange: (id: string) => void }) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const fetcher = useCallback(
    () => savingsService.accounts({ search, per_page: 25 }),
    [search],
  );
  const accounts = useApiResource(fetcher, search !== "");
  const options = (accounts.data?.data ?? [])
    .filter((a) => a.product.kind === "regular" && a.status !== "closed")
    .map((a) => ({
      value: String(a.id),
      label: `${a.account_number} · ${a.borrower_name ?? "Member"} · ${a.product.name}`,
    }));

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setSearch(draft.trim());
            }
          }}
          placeholder="Account no., member name or code"
          aria-label="Search savings accounts"
        />
        <Button type="button" variant="outline" size="icon" aria-label="Search" onClick={() => setSearch(draft.trim())}>
          <Search className="h-4 w-4" />
        </Button>
      </div>
      <OptionSelect
        id={id}
        value={value}
        onChange={onChange}
        options={options}
        disabled={search === "" || accounts.loading || options.length === 0}
        placeholder={
          search === ""
            ? "Search for the account first"
            : accounts.loading
              ? "Searching…"
              : options.length === 0
                ? "No open savings account matches"
                : "Choose the account"
        }
      />
    </div>
  );
}
