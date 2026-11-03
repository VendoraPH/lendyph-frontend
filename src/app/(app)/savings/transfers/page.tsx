"use client";

import { Suspense } from "react";
import { RouteGuard } from "@/components/common";
import { TransferFormContent } from "./_components/transfer-form";

export default function SavingsTransfersPage() {
  return (
    <RouteGuard permission="savings:transfer" pageName="Savings Transfers">
      {/* useSearchParams (the ?account= preselect) needs a Suspense boundary. */}
      <Suspense>
        <TransferFormContent />
      </Suspense>
    </RouteGuard>
  );
}
