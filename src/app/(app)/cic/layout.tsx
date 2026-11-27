import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { env } from "@/config/env";

// Gated on NEXT_PUBLIC_ENABLE_CIC, off by default, until the backend serves
// /cic. Hiding the menu is not enough, so a direct URL answers not found too.
export default function CicLayout({ children }: { children: ReactNode }) {
  if (!env.features.cic) {
    notFound();
  }

  return children;
}
