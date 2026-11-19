"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { AMLA_CUSTOMERS_PERMISSION } from "@/lib/amla/cdd-access";
import { CustomersWorklist } from "./_components/customers-worklist";

/** AMLA Compliance → Customers: the CDD worklist. The /amla layout already needs `amla:view`. */
export default function AmlaCustomersPage() {
  return (
    <RouteGuard permission={AMLA_CUSTOMERS_PERMISSION} pageName="Customers">
      <CustomersWorklist />
    </RouteGuard>
  );
}
