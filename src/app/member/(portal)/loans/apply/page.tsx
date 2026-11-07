"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { useApiResource } from "@/hooks/use-api-resource";
import { portalService } from "@/services/portal.service";
import { usePortalConfig } from "../../../_components/portal-config";
import { PortalPageHeader } from "../../../_components/portal-shell";
import { ServiceOff } from "../../../_components/service-off";
import { ApplicationWizard } from "./_components/application-wizard";

const fetchProducts = () => portalService.loanProducts();

export default function LoanApplicationPage() {
  const { config } = usePortalConfig();
  const enabled = config.features.loans && config.features.loan_applications;
  const products = useApiResource(fetchProducts, enabled);

  return (
    <>
      <Link href="/member/loans" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4" /> My loans
      </Link>
      <PortalPageHeader
        title="Apply for a loan"
        description="Choose a loan, tell us what you need, and attach your documents. The cooperative reviews every application."
      />
      {!enabled ? (
        <ServiceOff service="Online loan application" />
      ) : (
        <DataState
          resource={products}
          endpoints={["GET /portal/loan-products", "POST /portal/loan-applications"]}
          summary="The loans you can apply for will show here once online applications are connected."
          isEmpty={(rows) => rows.length === 0}
          emptyMessage="No loans are open for online application right now."
        >
          {(rows) => <ApplicationWizard products={rows} />}
        </DataState>
      )}
    </>
  );
}
