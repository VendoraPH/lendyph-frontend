"use client";

import { Suspense } from "react";
import { RouteGuard } from "@/components/common/route-guard";
import { AMLA_SCREENING_PERMISSION } from "@/lib/amla/screening-access";
import { ScreeningScreen } from "./_components/screening-screen";

/** Screening covers the whole cooperative, so it needs every branch as well, as its endpoints do. */
export default function AmlaScreeningPage() {
  return (
    <RouteGuard permission={AMLA_SCREENING_PERMISSION} pageName="Screening">
      <RouteGuard permission="branches:view_all" pageName="Screening">
        {/* The open tab is read from the URL, which needs a Suspense boundary. */}
        <Suspense fallback={null}>
          <ScreeningScreen />
        </Suspense>
      </RouteGuard>
    </RouteGuard>
  );
}
