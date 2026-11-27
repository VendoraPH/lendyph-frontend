"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { CollateralForm } from "../_components/collateral-form";
import { PageFill } from "@/components/common/page-fill";

export default function NewCollateralPage() {
  return (
    <RouteGuard permission="collaterals:create" pageName="Collateral Entry">
      <PageFill className="py-2">
        {/* Breadcrumb */}
        <Link
          href="/collaterals"
          className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Collaterals
        </Link>

        {/* Page header */}
        <header className="shrink-0 space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            Register New Collateral
          </h1>
          <p className="text-sm text-muted-foreground">
            Tag a collateral to a member. Some types (e.g. share capital)
            auto-derive their value from the member&apos;s account.
          </p>
        </header>

        <CollateralForm mode="create" />
      </PageFill>
    </RouteGuard>
  );
}
