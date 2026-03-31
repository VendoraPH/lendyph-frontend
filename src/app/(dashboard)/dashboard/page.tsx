"use client";

import { useMemo } from "react";
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

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getFormattedDate() {
  return new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function DashboardPage() {
  const greeting = useMemo(() => getGreeting(), []);
  const formattedDate = useMemo(() => getFormattedDate(), []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-xl border bg-gradient-to-r from-brand-orange/5 via-brand-orange/10 to-transparent px-6 py-5">
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}, Juan Admin
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{formattedDate}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-brand-blue">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Total Borrowers
                </p>
                <p className="text-2xl font-bold">1,248</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="text-green-600">+12%</span> from last month
                </p>
              </div>
              <div className="rounded-full bg-brand-blue/10 p-2.5">
                <Users className="h-5 w-5 text-brand-blue" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-brand-orange">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Active Loans
                </p>
                <p className="text-2xl font-bold">843</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="text-green-600">+5%</span> from last month
                </p>
              </div>
              <div className="rounded-full bg-brand-orange/10 p-2.5">
                <FileText className="h-5 w-5 text-brand-orange" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Total Collected
                </p>
                <p className="text-2xl font-bold">₱2.4M</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="text-green-600">+18%</span> from last month
                </p>
              </div>
              <div className="rounded-full bg-green-500/10 p-2.5">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Overdue Accounts
                </p>
                <p className="text-2xl font-bold text-destructive">47</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="text-destructive">+3</span> since yesterday
                </p>
              </div>
              <div className="rounded-full bg-red-500/10 p-2.5">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Total Portfolio
                </p>
                <p className="text-2xl font-bold">₱15.2M</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Outstanding balance across all loans
                </p>
              </div>
              <div className="rounded-full bg-brand-orange/10 p-2.5">
                <TrendingUp className="h-5 w-5 text-brand-orange" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Collection Rate
                </p>
                <p className="text-2xl font-bold text-green-600">94.5%</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  On-time payment percentage
                </p>
              </div>
              <div className="rounded-full bg-green-500/10 p-2.5">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Due Today
                </p>
                <p className="text-2xl font-bold">23</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Payments expected today
                </p>
              </div>
              <div className="rounded-full bg-brand-orange/10 p-2.5">
                <ClipboardList className="h-5 w-5 text-brand-orange" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {[
              {
                action: "Loan Released",
                detail: "₱50,000 to Maria Santos",
                time: "Today, 9:42 AM",
                link: "View loan",
                badge: "released",
                color: "bg-brand-orange text-brand-orange-foreground",
              },
              {
                action: "Payment Received",
                detail: "₱2,500 from Juan Dela Cruz",
                time: "Today, 8:15 AM",
                link: "View receipt",
                badge: "completed",
                color: "bg-green-600 text-white",
              },
              {
                action: "New Borrower",
                detail: "Ana Reyes registered",
                time: "Today, 6:30 AM",
                link: "View profile",
                badge: "new",
                color: "bg-brand-blue text-brand-blue-foreground",
              },
              {
                action: "Loan Approved",
                detail: "₱30,000 for Pedro Garcia",
                time: "Yesterday, 4:00 PM",
                link: "View loan",
                badge: "approved",
                color: "bg-brand-orange text-brand-orange-foreground",
              },
              {
                action: "Overdue Notice",
                detail: "3 borrowers are 7+ days overdue",
                time: "Yesterday, 2:00 PM",
                link: "View list",
                badge: "overdue",
                color: "bg-destructive text-white",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-border py-3 last:border-0"
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
                <div className="flex flex-col items-end gap-0.5 shrink-0 pl-4">
                  <p className="text-xs text-muted-foreground">{item.time}</p>
                  <button className="text-xs text-brand-orange hover:underline">
                    {item.link}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
