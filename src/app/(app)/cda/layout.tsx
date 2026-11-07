import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { env } from "@/config/env";

/** CDA Compliance is off unless the deployment sets NEXT_PUBLIC_ENABLE_CDA. */
export default function CdaLayout({ children }: { children: ReactNode }) {
  if (!env.features.cda) {
    notFound();
  }
  return children;
}
