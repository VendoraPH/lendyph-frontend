"use client";

import { FileInput } from "lucide-react";
import { usePathname } from "next/navigation";
import { FillSection, PageFill } from "@/components/common/page-fill";
import { OriginationNav } from "./origination-nav";

/** Header and tabs shared by every Loan Origination screen. */
export function OriginationShell({ children }: { children: React.ReactNode }) {
  // An application's own page has its own header and back link.
  const onDetail = /^\/loans\/origination\/applications\/\d+/.test(usePathname());

  return (
    <PageFill className="gap-4">
      {!onDetail && (
        <>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <FileInput className="h-6 w-6 text-brand-orange" />
              Loan Origination
            </h1>
            <p className="text-sm text-muted-foreground">
              Online loan applications from public links, from first visit to loan.
            </p>
          </div>
          <OriginationNav />
        </>
      )}
      <FillSection>{children}</FillSection>
    </PageFill>
  );
}
