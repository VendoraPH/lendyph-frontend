"use client";

import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatDate } from "@/lib/format";
import { MIN_SEARCH_LENGTH, SEARCH_KINDS, searchHref } from "@/lib/portal/engagement";
import { portalService } from "@/services/portal.service";
import { PortalPageHeader } from "../../_components/portal-shell";

/** Search the member's own records. The server scopes every result to them. */
export default function MemberSearchPage() {
  return (
    <>
      <PortalPageHeader
        title="Search"
        description="Find your transactions, loans, documents, receipts, statements and requests."
      />
      <Suspense>
        <SearchBody />
      </Suspense>
    </>
  );
}

function SearchBody() {
  const router = useRouter();
  const params = useSearchParams();
  const query = (params.get("q") ?? "").trim();
  const [draft, setDraft] = useState(query);
  const ready = query.length >= MIN_SEARCH_LENGTH;
  const fetcher = useCallback(() => portalService.search(query), [query]);
  const resource = useApiResource(fetcher, ready);

  return (
    <div className="space-y-4">
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const q = draft.trim();
          router.replace(q ? `/member/search?q=${encodeURIComponent(q)}` : "/member/search");
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            aria-label="Search your records"
            placeholder="A receipt number, loan number, amount…"
            className="pl-8"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
        </div>
        <Button type="submit">Search</Button>
      </form>
      {!ready ? (
        <p className="text-sm text-muted-foreground">
          {query ? `Type at least ${MIN_SEARCH_LENGTH} characters.` : "Type what you are looking for above."}
        </p>
      ) : (
        <DataState
          resource={resource}
          endpoints={["GET /portal/search?q="]}
          summary="Search across your own records."
          isEmpty={(rows) => rows.length === 0}
          emptyMessage={`Nothing of yours matches "${query}".`}
        >
          {(rows) => (
            <Card>
              <CardContent className="divide-y p-0">
                {rows.map((r) => (
                  <Link
                    key={`${r.kind}-${r.id}`}
                    href={searchHref(r)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50"
                  >
                    <span className="mt-0.5 w-20 shrink-0 text-xs font-medium text-muted-foreground">
                      {SEARCH_KINDS[r.kind] ?? r.kind}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.title}</span>
                      {r.subtitle && <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>}
                    </span>
                    {r.date && <span className="shrink-0 text-xs text-muted-foreground">{formatDate(r.date)}</span>}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </DataState>
      )}
    </div>
  );
}
