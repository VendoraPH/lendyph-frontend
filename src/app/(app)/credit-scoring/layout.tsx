import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { env } from "@/config/env";

// Gated on NEXT_PUBLIC_ENABLE_CREDIT_SCORING, off by default: every endpoint
// behind these screens answers 501 until it is built. Hiding the menu is not
// enough, so a direct URL answers not found too. It is a soft 404, the same as
// /loans/amortization-binhs.
export default function CreditScoringLayout({ children }: { children: ReactNode }) {
  if (!env.features.creditScoring) {
    notFound();
  }

  return children;
}
