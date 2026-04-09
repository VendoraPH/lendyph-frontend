"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
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
import { Zap, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));

// Mock data — replace with API integration
const MOCK_MEMBERS = [
  { id: 1, borrower: "Rosario D. Santos", pledgeAmount: 500, autoCredit: true },
  { id: 2, borrower: "Roberto Garcia", pledgeAmount: 1000, autoCredit: true },
  { id: 3, borrower: "Eduardo Mendoza", pledgeAmount: 500, autoCredit: true },
  { id: 4, borrower: "Maria L. Reyes", pledgeAmount: 500, autoCredit: false },
  { id: 5, borrower: "Ana Santos", pledgeAmount: 1000, autoCredit: true },
  { id: 6, borrower: "Carmen Torres", pledgeAmount: 500, autoCredit: false },
  { id: 7, borrower: "Jose P. Dela Cruz", pledgeAmount: 0, autoCredit: true },
  { id: 8, borrower: "Lorna M. Bautista", pledgeAmount: 0, autoCredit: false },
];

export default function AutoCreditPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [showDisabled, setShowDisabled] = useState(false);
  const [showNoPledge, setShowNoPledge] = useState(false);

  const activeMembers = MOCK_MEMBERS.filter((m) => m.autoCredit && m.pledgeAmount > 0);
  const disabledMembers = MOCK_MEMBERS.filter((m) => !m.autoCredit);
  const noPledgeMembers = MOCK_MEMBERS.filter((m) => m.pledgeAmount === 0);
  const totalPledge = activeMembers.reduce((sum, m) => sum + m.pledgeAmount, 0);

  function handleInitiate() {
    setConfirmOpen(true);
  }

  function handleConfirm() {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setConfirmOpen(false);
      setLastRun(new Date().toLocaleString("en-PH"));
      toast.success(`Auto-credit completed: ${formatCurrency(totalPledge)} credited to ${activeMembers.length} members`);
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
                  members&apos; share capital accounts.
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
                <span className="text-2xl font-bold">{activeMembers.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total to Credit</span>
                <span className="text-2xl font-bold text-green-600">{formatCurrency(totalPledge)}</span>
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

        {/* Warnings: Disabled & No Pledge */}
        {(disabledMembers.length > 0 || noPledgeMembers.length > 0) && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {disabledMembers.length > 0 && (
              <Card className="border-amber-500/30">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Auto-Credit Disabled</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {disabledMembers.length} member{disabledMembers.length > 1 ? "s" : ""} will not be credited
                      </p>
                      <button
                        className="text-xs text-brand-orange hover:underline mt-1"
                        onClick={() => setShowDisabled(true)}
                      >
                        View accounts →
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {noPledgeMembers.length > 0 && (
              <Card className="border-red-500/30">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">No Pledge Amount</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {noPledgeMembers.length} member{noPledgeMembers.length > 1 ? "s" : ""} with no pledge amount set
                      </p>
                      <button
                        className="text-xs text-brand-orange hover:underline mt-1"
                        onClick={() => setShowNoPledge(true)}
                      >
                        View accounts →
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Confirm Dialog — Total Pledge Amount (large font) */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-brand-orange" />
                Confirm Auto-Credit
              </DialogTitle>
              <DialogDescription>
                The following total amount will be credited to {activeMembers.length} active members.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center py-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Pledge Amount</p>
              <p className="text-5xl font-bold text-brand-orange">{formatCurrency(totalPledge)}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {activeMembers.length} member{activeMembers.length > 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={processing}>
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

        {/* Disabled Auto-Credit Accounts Dialog */}
        <Dialog open={showDisabled} onOpenChange={setShowDisabled}>
          <DialogContent size="md">
            <DialogHeader>
              <DialogTitle>Auto-Credit Disabled Accounts</DialogTitle>
              <DialogDescription>
                These members have auto-credit turned off and will not be included.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[50vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Pledge Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disabledMembers.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium text-sm">{m.borrower}</TableCell>
                      <TableCell className="text-right text-sm">
                        {m.pledgeAmount > 0 ? formatCurrency(m.pledgeAmount) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-xs">
                          Disabled
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>

        {/* No Pledge Amount Accounts Dialog */}
        <Dialog open={showNoPledge} onOpenChange={setShowNoPledge}>
          <DialogContent size="md">
            <DialogHeader>
              <DialogTitle>Accounts with No Pledge Amount</DialogTitle>
              <DialogDescription>
                These members have no pledge amount configured.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[50vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Auto-Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {noPledgeMembers.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium text-sm">{m.borrower}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            m.autoCredit
                              ? "bg-green-500/10 text-green-700 border-green-500/30 text-xs"
                              : "bg-red-500/10 text-red-700 border-red-500/30 text-xs"
                          }
                        >
                          {m.autoCredit ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RouteGuard>
  );
}
