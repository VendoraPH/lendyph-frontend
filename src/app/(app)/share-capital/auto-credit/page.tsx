"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));

// Mock data — replace with API integration
const MOCK_PREVIEW = [
  { id: 1, borrower: "Rosario D. Santos", pledgeAmount: 500, currentBalance: 3000 },
  { id: 2, borrower: "Roberto Garcia", pledgeAmount: 1000, currentBalance: 7000 },
  { id: 3, borrower: "Eduardo Mendoza", pledgeAmount: 500, currentBalance: 2000 },
  { id: 5, borrower: "Ana Santos", pledgeAmount: 1000, currentBalance: 4000 },
];

export default function AutoCreditPage() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const totalToCredit = MOCK_PREVIEW.reduce((sum, p) => sum + p.pledgeAmount, 0);

  function handleInitiate() {
    setPreviewOpen(true);
  }

  function handleConfirm() {
    setProcessing(true);
    // Simulate API call
    setTimeout(() => {
      setProcessing(false);
      setPreviewOpen(false);
      setLastRun(new Date().toLocaleString("en-PH"));
      toast.success(`Auto-credit completed: ${formatCurrency(totalToCredit)} credited to ${MOCK_PREVIEW.length} members`);
    }, 2000);
  }

  return (
    <RouteGuard permission="share_capital:create" pageName="Auto-Credit">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auto-Credit Pledges</h1>
          <p className="text-muted-foreground">
            Initiate auto-credit of all active pledge entries
          </p>
        </div>

        {/* Status Card */}
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="h-16 w-16 rounded-full bg-brand-orange/10 flex items-center justify-center">
                <Zap className="h-8 w-8 text-brand-orange" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Auto-Credit Share Capital</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  This will credit all active pledge amounts to their respective
                  members&apos; share capital accounts. A preview will be shown before processing.
                </p>
              </div>
              <Button
                onClick={handleInitiate}
                size="lg"
                className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark mt-2"
              >
                <Zap className="mr-2 h-4 w-4" />
                Initiate Auto-Credit
              </Button>
              {lastRun && (
                <p className="text-xs text-muted-foreground mt-2">
                  Last run: {lastRun}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Active Members</span>
                <span className="text-2xl font-bold">{MOCK_PREVIEW.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total to Credit</span>
                <span className="text-2xl font-bold text-green-600">{formatCurrency(totalToCredit)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <Badge variant="outline" className={lastRun ? "bg-green-500/10 text-green-700 border-green-500/30" : "bg-muted text-muted-foreground"}>
                  {lastRun ? "Completed" : "Pending"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Confirmation Dialog with Preview */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-brand-orange" />
                Auto-Credit Preview
              </DialogTitle>
              <DialogDescription>
                Review the pledges below before processing. Please verify actual pledge
                collections against these amounts before continuing.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[50vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member/Borrower</TableHead>
                    <TableHead className="text-right">Current Balance</TableHead>
                    <TableHead className="text-right">Pledge Amount</TableHead>
                    <TableHead className="text-right">New Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_PREVIEW.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium text-sm">{entry.borrower}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatCurrency(entry.currentBalance)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-green-600">
                        +{formatCurrency(entry.pledgeAmount)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(entry.currentBalance + entry.pledgeAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-semibold text-green-600">
                      +{formatCurrency(totalToCredit)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={processing}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={processing}
                className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              >
                {processing ? (
                  <>
                    <Spinner className="size-4 mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirm & Process
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RouteGuard>
  );
}
