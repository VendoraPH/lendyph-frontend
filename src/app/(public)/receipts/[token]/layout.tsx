import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/config/env";

export const metadata: Metadata = {
  title: "Payment receipt",
  // A shared receipt is for whoever got the link, never for search engines.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Shared receipts exist only on deployments that turned them on. */
export default function SharedReceiptLayout({ children }: { children: React.ReactNode }) {
  if (!env.features.receiptShareLinks) notFound();
  return children;
}
