import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { env } from "@/config/env";

/** Penalty configurations are off unless NEXT_PUBLIC_ENABLE_PENALTY_CONFIGS is set at build time. */
export default function PenaltiesLayout({ children }: { children: ReactNode }) {
  if (!env.features.penaltyConfigs) notFound();
  return children;
}
