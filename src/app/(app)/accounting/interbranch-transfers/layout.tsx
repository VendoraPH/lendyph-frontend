import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { env } from "@/config/env";

/** Interbranch Transfers is off unless NEXT_PUBLIC_ENABLE_MULTI_BRANCH is set at build time. */
export default function InterbranchTransfersLayout({ children }: { children: ReactNode }) {
  if (!env.features.multiBranch) notFound();
  return children;
}
