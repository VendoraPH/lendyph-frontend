import { Suspense } from "react";
import type { Metadata } from "next";
import { ActivateFlow } from "../../_components/activate-flow";

export const metadata: Metadata = { title: "Activate your account" };

// The invitation link carries ?token=, read with useSearchParams.
export default function ActivatePage() {
  return (
    <Suspense>
      <ActivateFlow />
    </Suspense>
  );
}
