"use client";

import { usePortalConfig } from "../../_components/portal-config";
import { PortalPageHeader } from "../../_components/portal-shell";
import { ServiceOff } from "../../_components/service-off";
import { FaqList } from "./_components/faq-list";
import { TicketsCard } from "./_components/tickets-card";

export default function MemberHelpPage() {
  const { config } = usePortalConfig();
  return (
    <>
      <PortalPageHeader
        title="Help and support"
        description={
          config.support_contact
            ? `Answers to common questions, or ask us directly. You can also reach us at ${config.support_contact}.`
            : "Answers to common questions, or ask us directly."
        }
      />
      {config.features.help_desk ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <FaqList />
          <TicketsCard />
        </div>
      ) : (
        <ServiceOff service="Help and support" />
      )}
    </>
  );
}
