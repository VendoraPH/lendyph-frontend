"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { CollateralForm } from "../_components/collateral-form";

export default function NewCollateralPage() {
  return (
    <RouteGuard permission="collaterals:create" pageName="Collateral Entry">
      <div className="max-w-2xl space-y-4">
        <Link
          href="/collaterals"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Collaterals
        </Link>
        <CollateralForm mode="create" />
      </div>
    </RouteGuard>
  );
}
