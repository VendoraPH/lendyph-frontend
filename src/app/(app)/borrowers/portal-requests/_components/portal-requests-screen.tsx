"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemberRequestsTable } from "./member-requests-table";
import { ProfileRequestsQueue } from "./profile-requests-queue";
import { SupportTicketsTable } from "./support-tickets-table";

/** Staff review of what members asked for through the Member Portal. */
export function PortalRequestsScreen() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Portal Requests</h1>
        <p className="text-sm text-muted-foreground">
          Review service requests, profile changes and support questions members sent through the Member Portal. Every
          reply you write is shown to the member.
        </p>
      </div>
      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Member requests</TabsTrigger>
          <TabsTrigger value="profile">Profile changes</TabsTrigger>
          <TabsTrigger value="tickets">Support tickets</TabsTrigger>
        </TabsList>
        <TabsContent value="requests" className="pt-4">
          <MemberRequestsTable />
        </TabsContent>
        <TabsContent value="profile" className="pt-4">
          <ProfileRequestsQueue />
        </TabsContent>
        <TabsContent value="tickets" className="pt-4">
          <SupportTicketsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
