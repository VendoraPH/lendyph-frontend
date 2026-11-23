"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { CasesList } from "../_components/cases-list";

/** `amla:cases` with every branch, as the case routes need (amla/layout.tsx already needs amla:view). */
export default function AmlaCasesPage() {
  return (
    <RouteGuard permission="amla:cases" pageName="Compliance Cases">
      <RouteGuard permission="branches:view_all" pageName="Compliance Cases">
        <CasesList />
      </RouteGuard>
    </RouteGuard>
  );
}
