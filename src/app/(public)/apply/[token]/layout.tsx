import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/config/env";

export const metadata: Metadata = {
  title: "Apply for a loan",
  robots: { index: false, follow: false },
};

/** The public application exists only on deployments that turned it on. */
export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  if (!env.features.loanOrigination) notFound();
  return children;
}
