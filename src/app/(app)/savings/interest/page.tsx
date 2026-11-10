"use client";

import { useEffect, useState } from "react";
import { RouteGuard } from "@/components/common";
import { usePermission } from "@/hooks";
import { savingsService } from "@/services";
import type { SavingsProduct } from "@/types";
import { runProductOptions } from "./_lib/run-rules";
import { NewRunPanel } from "./_components/new-run-panel";
import { RunsList } from "./_components/runs-list";

function InterestRunsContent() {
  const canRun = usePermission().can("savings:post");
  const [products, setProducts] = useState<SavingsProduct[]>([]);
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    savingsService
      .products()
      .then((rows) => {
        if (!cancelled) setProducts(rows);
      })
      .catch(() => {
        // The product filters stay at "All products"; the runs list says what failed.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const productOptions = runProductOptions(products);

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Savings Interest</h1>
        <p className="text-sm text-muted-foreground">
          Work out a period&apos;s interest on the server, save it as one draft run per branch, then another user
          approves it before it posts.
        </p>
      </div>
      {canRun && <NewRunPanel productOptions={productOptions} onCreated={() => setListKey((k) => k + 1)} />}
      <RunsList key={listKey} productOptions={productOptions} />
    </div>
  );
}

export default function SavingsInterestPage() {
  return (
    <RouteGuard permission="savings:view" pageName="Savings Interest">
      <InterestRunsContent />
    </RouteGuard>
  );
}
