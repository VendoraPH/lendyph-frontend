import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { env } from "@/config/env";

/** Settings → AMLA is off unless NEXT_PUBLIC_ENABLE_AMLA is set at build time. */
export default function AmlaSettingsLayout({ children }: { children: ReactNode }) {
  if (!env.features.amla) notFound();
  return children;
}
