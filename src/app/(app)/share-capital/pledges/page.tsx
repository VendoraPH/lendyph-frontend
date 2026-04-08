"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Settings2 } from "lucide-react";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));

// Mock data — replace with API integration
const INITIAL_PLEDGES = [
  { id: 1, borrower: "Rosario D. Santos", amount: 500, schedule: "15/30" as const, autoCredit: true },
  { id: 2, borrower: "Roberto Garcia", amount: 1000, schedule: "15/30" as const, autoCredit: true },
  { id: 3, borrower: "Eduardo Mendoza", amount: 500, schedule: "30" as const, autoCredit: true },
  { id: 4, borrower: "Maria L. Reyes", amount: 500, schedule: "15/30" as const, autoCredit: false },
  { id: 5, borrower: "Ana Santos", amount: 1000, schedule: "15" as const, autoCredit: true },
  { id: 6, borrower: "Carmen Torres", amount: 500, schedule: "30" as const, autoCredit: false },
];

const SCHEDULE_OPTIONS = [
  { value: "15", label: "Every 15th" },
  { value: "30", label: "Every 30th" },
  { value: "15/30", label: "Every 15th & 30th" },
];

export default function PledgeEntryPage() {
  const [pledges, setPledges] = useState(INITIAL_PLEDGES);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newBorrower, setNewBorrower] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newSchedule, setNewSchedule] = useState("15/30");

  const filtered = pledges.filter((p) =>
    p.borrower.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = pledges.filter((p) => p.autoCredit).length;
  const totalPledge = pledges.reduce((sum, p) => sum + p.amount, 0);

  function handleToggleAutoCredit(id: number) {
    setPledges((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, autoCredit: !p.autoCredit } : p
      )
    );
    const pledge = pledges.find((p) => p.id === id);
    if (pledge) {
      toast.success(
        pledge.autoCredit
          ? `Auto-credit deactivated for ${pledge.borrower}`
          : `Auto-credit activated for ${pledge.borrower}`
      );
    }
  }

  function handleAdd() {
    if (!newBorrower.trim() || !newAmount) return;
    setPledges((prev) => [
      ...prev,
      {
        id: Math.max(...prev.map((p) => p.id)) + 1,
        borrower: newBorrower.trim(),
        amount: Number(newAmount),
        schedule: newSchedule as "15" | "30" | "15/30",
        autoCredit: true,
      },
    ]);
    setNewBorrower("");
    setNewAmount("");
    setNewSchedule("15/30");
    setAddOpen(false);
    toast.success("Pledge entry added");
  }

  return (
    <RouteGuard permission="share_capital:view" pageName="Pledge Entry">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pledge Entry</h1>
            <p className="text-muted-foreground">
              Configure share capital pledges for members
            </p>
          </div>
          <Button
            onClick={() => setAddOpen(true)}
            className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Pledge
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total Pledges</span>
                <span className="text-2xl font-bold">{pledges.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-600">Active Auto-Credit</span>
                <span className="text-2xl font-bold text-green-600">{activeCount}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total Amount</span>
                <span className="text-2xl font-bold text-brand-orange">{formatCurrency(totalPledge)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">All Pledges</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search member..."
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
                    <TableHead>Member/Borrower</TableHead>
                    <TableHead>Pledge Amount</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Auto-Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((pledge) => (
                    <TableRow key={pledge.id}>
                      <TableCell className="font-medium text-sm">{pledge.borrower}</TableCell>
                      <TableCell className="text-sm">{formatCurrency(pledge.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          <Settings2 className="h-3 w-3 mr-1" />
                          {SCHEDULE_OPTIONS.find((s) => s.value === pledge.schedule)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={pledge.autoCredit}
                            onCheckedChange={() => handleToggleAutoCredit(pledge.id)}
                          />
                          <span className={`text-xs font-medium ${pledge.autoCredit ? "text-green-600" : "text-muted-foreground"}`}>
                            {pledge.autoCredit ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No pledges found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Add Pledge Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Add Pledge Entry</DialogTitle>
              <DialogDescription>
                Configure a new share capital pledge for a member.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Member/Borrower *</Label>
                <Input
                  placeholder="Enter member name"
                  value={newBorrower}
                  onChange={(e) => setNewBorrower(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Pledge Amount (PHP) *</Label>
                <Input
                  type="number"
                  placeholder="500"
                  min={1}
                  step="1"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Credit Schedule *</Label>
                <Select value={newSchedule} onValueChange={(v) => setNewSchedule(v ?? "15/30")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAdd}
                  disabled={!newBorrower.trim() || !newAmount}
                  className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
                >
                  Add Pledge
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RouteGuard>
  );
}
