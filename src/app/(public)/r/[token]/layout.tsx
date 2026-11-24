import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/config/env";

export const metadata: Metadata = {
  title: "Payment receipt",
  robots: { index: false, follow: false },
  // The address holds the link's token: never sent on to another site.
  referrer: "same-origin",
};

/** A shared receipt exists only on deployments that turned share links on. */
export default function SharedReceiptLayout({ children }: { children: React.ReactNode }) {
  if (!env.features.receiptShareLinks) notFound();
  return children;
}
