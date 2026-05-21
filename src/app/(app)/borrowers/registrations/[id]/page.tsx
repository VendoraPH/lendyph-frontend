// src/app/(app)/borrowers/registrations/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { Spinner } from "@/components/ui/spinner";
import {
  registrationService,
  type Registration,
  type RegistrationPayload,
  type RegistrationValidId,
} from "@/services/registration.service";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/app/(app)/borrowers/_components/utils";
import { RegistrationInfoCards } from "./_components/registration-info-cards";
import { ReviewActionPanel } from "./_components/review-action-panel";
import { RejectDialog } from "./_components/reject-dialog";

export default function RegistrationReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const registrationId = Number(id);

  const [registration, setRegistration] = useState<Registration | null>(null);
  const [validIds, setValidIds] = useState<RegistrationValidId[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<Partial<RegistrationPayload>>({});
  const [approving, setApproving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await registrationService.get(registrationId);
        setRegistration(data);
        // Valid IDs are a best-effort fetch — applicants may not have
        // uploaded any, and we don't want a missing endpoint to block
        // the review screen.
        try {
          const ids = await registrationService.listValidIds(registrationId);
          setValidIds(Array.isArray(ids) ? ids : []);
        } catch {
          setValidIds([]);
        }
      } catch {
        setLoadError("Failed to load registration. It may have been processed already.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [registrationId]);

  function handleDraftChange<K extends keyof RegistrationPayload>(
    field: K,
    value: RegistrationPayload[K]
  ) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function handleApprove() {
    setApproving(true);
    try {
      await registrationService.approve(registrationId);
      toast.success("Registration approved. Member profile activated.");
      router.push(`/borrowers/${registrationId}`);
    } catch {
      toast.error("Failed to approve registration. Please try again.");
    } finally {
      setApproving(false);
    }
  }

  async function handleSaveEdit() {
    setSavingEdit(true);
    try {
      await registrationService.update(registrationId, draft);
      await registrationService.approve(registrationId);
      toast.success("Registration updated and approved. Member profile activated.");
      router.push(`/borrowers/${registrationId}`);
    } catch {
      toast.error("Failed to save and approve. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleReject() {
    await registrationService.reject(registrationId);
    toast.success("Registration rejected.");
    setRejectOpen(false);
    router.push("/borrowers");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !registration) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive/60" />
        <p className="text-sm text-muted-foreground">{loadError ?? "Registration not found."}</p>
        <Link href="/borrowers" className="text-sm text-brand-orange hover:underline">
          ← Back to Members
        </Link>
      </div>
    );
  }

  const fullName = `${registration.first_name} ${registration.last_name}`;
  const validIdsByLabel = validIds.reduce<Record<string, RegistrationValidId[]>>(
    (acc, v) => {
      const key = v.custom_type_name?.trim() || v.label;
      (acc[key] ??= []).push(v);
      return acc;
    },
    {}
  );

  return (
    <RouteGuard permission="borrowers:create" pageName="Review Registration">
      <>
        <div className="space-y-4 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-start gap-4">
            <Avatar size="lg" className="hidden sm:flex h-16 w-16">
              {registration.photo_url ? (
                <AvatarImage src={registration.photo_url} alt={fullName} />
              ) : null}
              <AvatarFallback className="bg-brand-orange/10 text-brand-orange text-base font-semibold">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <Link
                href="/borrowers"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Members
              </Link>
              <h1 className="text-2xl font-bold tracking-tight truncate">
                Review Registration — {fullName}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Submitted {registration.submitted_at ? new Date(registration.submitted_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—"} · Pending verification
              </p>
            </div>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            <div className="space-y-4 min-w-0">
              <RegistrationInfoCards
                registration={registration}
                editMode={editMode}
                draft={draft}
                onDraftChange={handleDraftChange}
              />

              {validIds.length > 0 && (
                <Card>
                  <CardContent className="pt-5">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-3 pb-2 border-b border-brand-orange/20">
                      Valid IDs
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      {Object.entries(validIdsByLabel).map(([label, items]) => {
                        const idNumber = items.find((i) => i.id_number)?.id_number;
                        return (
                          <div key={label} className="space-y-2">
                            <div>
                              <p className="text-sm font-semibold capitalize">
                                {label.replaceAll("_", " ")}
                              </p>
                              {idNumber && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  {idNumber}
                                </p>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {items
                                .sort((a, b) => (a.side === "front" ? -1 : 1))
                                .map((item) => (
                                  <a
                                    key={item.id}
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group block aspect-[3/2] overflow-hidden rounded-md border border-border bg-muted/30 hover:border-brand-orange/50 transition-colors"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={item.url}
                                      alt={`${label} ${item.side}`}
                                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                    />
                                    <p className="sr-only">{item.side}</p>
                                  </a>
                                ))}
                            </div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                              {items.map((i) => i.side).join(" · ")}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            <ReviewActionPanel
              registration={registration}
              editMode={editMode}
              approving={approving}
              savingEdit={savingEdit}
              onApprove={handleApprove}
              onReject={() => setRejectOpen(true)}
              onToggleEdit={() => { setEditMode((prev) => !prev); setDraft({}); }}
              onSaveEdit={handleSaveEdit}
            />
          </div>
        </div>

        <RejectDialog
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          onConfirm={handleReject}
        />
      </>
    </RouteGuard>
  );
}
