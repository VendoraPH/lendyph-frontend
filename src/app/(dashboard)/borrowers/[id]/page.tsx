"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Borrower } from "@/types";
import { INITIAL_BORROWERS, MOCK_LOANS } from "../_components/mock-data";
import { MOCK_PAYMENTS, MOCK_CO_MAKERS } from "./_components/mock-detail-data";
import { BorrowerHeader } from "./_components/borrower-header";
import { OverviewTab } from "./_components/overview-tab";
import { LoansTab } from "./_components/loans-tab";
import { PaymentsTab } from "./_components/payments-tab";
import { CoMakersTab } from "./_components/co-makers-tab";

export default function BorrowerDetailPage() {
  const params = useParams();
  const borrowerId = Number(params.id);

  const [borrower, setBorrower] = useState<Borrower | undefined>(() =>
    INITIAL_BORROWERS.find((b) => b.id === borrowerId)
  );

  if (!borrower) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Borrower not found.</p>
      </div>
    );
  }

  const loans = MOCK_LOANS[borrower.id] ?? [];
  const payments = MOCK_PAYMENTS[borrower.id] ?? [];
  const coMakers = MOCK_CO_MAKERS[borrower.id] ?? [];

  return (
    <div className="space-y-6">
      <BorrowerHeader
        borrower={borrower}
        onEdit={() => {
          // Edit functionality will be wired in a future task
        }}
      />

      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="loans">
            Loans ({loans.length})
          </TabsTrigger>
          <TabsTrigger value="payments">
            Payments ({payments.length})
          </TabsTrigger>
          <TabsTrigger value="co-makers">
            Co-Makers ({coMakers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <OverviewTab borrower={borrower} loans={loans} />
        </TabsContent>

        <TabsContent value="loans" className="pt-4">
          <LoansTab loans={loans} />
        </TabsContent>

        <TabsContent value="payments" className="pt-4">
          <PaymentsTab payments={payments} loans={loans} />
        </TabsContent>

        <TabsContent value="co-makers" className="pt-4">
          <CoMakersTab coMakers={coMakers} loans={loans} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
