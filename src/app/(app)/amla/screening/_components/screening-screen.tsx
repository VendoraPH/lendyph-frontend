"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FillSection, PageFill, ScrollBox } from "@/components/common/page-fill";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchesTab } from "./matches-tab";
import { WatchlistsTab } from "./watchlists-tab";

const TABS = [
  { value: "matches", label: "Matches" },
  { value: "watchlists", label: "Watchlists" },
] as const;

/**
 * Watchlist and sanctions screening: possible matches for a person to decide,
 * and the uploaded lists they come from. The open tab is kept in `?tab=`.
 * Tabs mount when opened, so each list is read only when its tab is.
 */
export function ScreeningScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "watchlists" ? "watchlists" : "matches";
  const setTab = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <PageFill>
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Screening</h1>
        <p className="text-sm text-muted-foreground">
          Members, walk-ins and co-makers are screened against the uploaded lists. A possible match is never confirmed by the
          system: a person confirms or clears it.
        </p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="max-w-full shrink-0 justify-start overflow-x-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="matches" className="min-h-0 flex-1">
          <FillSection className="h-full">
            <MatchesTab />
          </FillSection>
        </TabsContent>
        <TabsContent value="watchlists" className="min-h-0 flex-1">
          <ScrollBox className="h-full space-y-4 p-px">
            <WatchlistsTab />
          </ScrollBox>
        </TabsContent>
      </Tabs>
    </PageFill>
  );
}
