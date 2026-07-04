"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
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
      <div className="mx-auto w-full max-w-2xl space-y-6 py-2">
        {/* Breadcrumb */}
        <Link
          href="/collaterals"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Collaterals
        </Link>

        {/* Page header */}
        <header className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            Edit Collateral
          </h1>
          <p className="text-sm text-muted-foreground">
            Update collateral details. The member assignment is locked once
            registered.
          </p>
        </header>

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Spinner className="size-6" />
                <p className="text-sm">Loading collateral…</p>
              </div>
            </CardContent>
          </Card>
        ) : collateral ? (
          <CollateralForm mode="edit" initial={collateral} />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <FileQuestion className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Collateral not found</p>
                <p className="text-xs text-muted-foreground">
                  This collateral may have been deleted or you don&apos;t have
                  access to it.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </RouteGuard>
  );
}
