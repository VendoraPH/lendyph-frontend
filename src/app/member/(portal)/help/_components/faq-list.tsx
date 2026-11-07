"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiResource } from "@/hooks/use-api-resource";
import { filterFaqs, groupBy } from "@/lib/portal/engagement";
import { portalService } from "@/services/portal.service";
import type { PortalFaq } from "@/types/portal";

export function FaqList() {
  const fetcher = useCallback(() => portalService.faqs(), []);
  const resource = useApiResource(fetcher);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Frequently asked questions</CardTitle>
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          endpoints={["GET /portal/help/faqs"]}
          summary="Answers to common questions."
          isEmpty={(rows) => rows.length === 0}
          emptyMessage="No questions have been added yet. Ask us directly instead."
        >
          {(rows) => <Faqs rows={rows} />}
        </DataState>
      </CardContent>
    </Card>
  );
}

function Faqs({ rows }: { rows: PortalFaq[] }) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupBy(filterFaqs(rows, query), (f) => f.category || "General"), [rows, query]);

  return (
    <div className="space-y-4">
      <Input
        type="search"
        aria-label="Search the questions"
        placeholder="Search the questions"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {groups.length === 0 && <p className="text-sm text-muted-foreground">No question matches that.</p>}
      {groups.map((g) => (
        <section key={g.key} className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.key}</h3>
          {g.rows.map((f) => (
            <details key={f.id} className="group rounded-md border px-3 py-2">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
                <span className="flex-1">{f.question}</span>
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{f.answer}</p>
            </details>
          ))}
        </section>
      ))}
    </div>
  );
}
