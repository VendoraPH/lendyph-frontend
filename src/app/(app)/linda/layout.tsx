import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { env } from "@/config/env";

/** /linda is off unless NEXT_PUBLIC_ENABLE_LINDA is set at build time. */
export default function LindaLayout({ children }: { children: ReactNode }) {
  if (!env.features.linda) notFound();
  return children;
}
