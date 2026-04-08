"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Landmark, Search } from "lucide-react";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));

// Mock data — replace with API integration
const MOCK_LEDGER = [
  { id: 1, borrower: "Rosario D. Santos", date: "2026-04-01", type: "credit" as const, amount: 500, balance: 3500, reference: "PLG-2026-0042" },
  { id: 2, borrower: "Roberto Garcia", date: "2026-04-01", type: "credit" as const, amount: 1000, balance: 8000, reference: "PLG-2026-0043" },
  { id: 3, borrower: "Eduardo Mendoza", date: "2026-03-30", type: "credit" as const, amount: 500, balance: 2500, reference: "PLG-2026-0038" },
  { id: 4, borrower: "Maria L. Reyes", date: "2026-03-30", type: "credit" as const, amount: 500, balance: 4000, reference: "PLG-2026-0039" },
  { id: 5, borrower: "Ana Santos", date: "2026-03-15", type: "credit" as const, amount: 1000, balance: 5000, reference: "PLG-2026-0030" },
  { id: 6, borrower: "Carmen Torres", date: "2026-03-15", type: "credit" as const, amount: 500, balance: 1500, reference: "PLG-2026-0031" },
];

export default function SubsidiaryLedgerPage() {
  const [search, setSearch] = useState("");

  const filtered = MOCK_LEDGER.filter(
    (entry) =>
      entry.borrower.toLowerCase().includes(search.toLowerCase()) ||
      entry.reference.toLowerCase().includes(search.toLowerCase())
  );

  const totalBalance = MOCK_LEDGER.reduce((sum, e) => sum + e.balance, 0);
  const totalCredits = MOCK_LEDGER.reduce((sum, e) => sum + e.amount, 0);

  return (
    <RouteGuard permission="share_capital:view" pageName="Subsidiary Ledger">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subsidiary Ledger</h1>
          <p className="text-muted-foreground">
            View credited pledges and share capital balances
          </p>
        </div>

        {/* Summary */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Landmark className="h-4 w-4" />
                  <span className="text-sm font-medium">Total Members</span>
                </div>
                <span className="text-2xl font-bold">{new Set(MOCK_LEDGER.map((e) => e.borrower)).size}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total Credits</span>
                <span className="text-2xl font-bold text-green-600">{formatCurrency(totalCredits)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total Balance</span>
                <span className="text-2xl font-bold text-brand-orange">{formatCurrency(totalBalance)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Ledger Entries</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search borrower or reference..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Member/Borrower</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(entry.date).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{entry.borrower}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{entry.reference}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                          Credit
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-green-600">
                        +{formatCurrency(entry.amount)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(entry.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No entries found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </RouteGuard>
  );
}
