"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { Spinner } from "@/components/ui/spinner";
import { collateralService } from "@/services";
import type { Collateral } from "@/types";
import { CollateralForm } from "../_components/collateral-form";

export default function EditCollateralPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const [collateral, setCollateral] = useState<Collateral | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    collateralService
      .detail(id)
      .then((c) => {
        if (!cancelled) setCollateral(c);
      })
      .catch(() => {
        if (!cancelled) setCollateral(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <RouteGuard permission="collaterals:update" pageName="Edit Collateral">
      <div className="max-w-2xl space-y-4">
        <Link
          href="/collaterals"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Collaterals
        </Link>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        ) : collateral ? (
          <CollateralForm mode="edit" initial={collateral} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Collateral not found.
          </p>
        )}
      </div>
    </RouteGuard>
  );
}
