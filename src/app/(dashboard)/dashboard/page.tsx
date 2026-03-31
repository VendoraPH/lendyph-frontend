"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  FileText,
  CreditCard,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
} from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">
          Your lending business at a glance
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Borrowers
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">1,248</p>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+12%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">843</p>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+5%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Collected
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₱2.4M</p>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+18%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Overdue Accounts
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">47</p>
            <p className="text-xs text-muted-foreground">
              <span className="text-destructive">+3</span> since yesterday
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Portfolio
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-brand-orange" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">₱15.2M</p>
            <p className="text-xs text-muted-foreground">
              Outstanding balance across all loans
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Collection Rate
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">94.5%</p>
            <p className="text-xs text-muted-foreground">
              On-time payment percentage
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Due Today</CardTitle>
            <ClipboardList className="h-4 w-4 text-brand-orange" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">23</p>
            <p className="text-xs text-muted-foreground">
              Payments expected today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                action: "Loan Released",
                detail: "₱50,000 to Maria Santos",
                time: "2 hours ago",
                badge: "released",
                color: "bg-brand-orange text-brand-orange-foreground",
              },
              {
                action: "Payment Received",
                detail: "₱2,500 from Juan Dela Cruz",
                time: "3 hours ago",
                badge: "completed",
                color: "bg-green-600 text-white",
              },
              {
                action: "New Borrower",
                detail: "Ana Reyes registered",
                time: "5 hours ago",
                badge: "new",
                color: "bg-brand-blue text-brand-blue-foreground",
              },
              {
                action: "Loan Approved",
                detail: "₱30,000 for Pedro Garcia",
                time: "Yesterday",
                badge: "approved",
                color: "bg-brand-orange text-brand-orange-foreground",
              },
              {
                action: "Overdue Notice",
                detail: "3 borrowers are 7+ days overdue",
                time: "Yesterday",
                badge: "overdue",
                color: "bg-destructive text-white",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <Badge className={item.color}>{item.badge}</Badge>
                  <div>
                    <p className="text-sm font-medium">{item.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{item.time}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
