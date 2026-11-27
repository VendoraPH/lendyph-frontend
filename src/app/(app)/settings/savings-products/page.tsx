"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { ProductsScreen } from "./_components/products-screen";

export default function SavingsProductsPage() {
  return (
    <RouteGuard permission="savings:settings" pageName="Savings Products">
      <ProductsScreen />
    </RouteGuard>
  );
}
