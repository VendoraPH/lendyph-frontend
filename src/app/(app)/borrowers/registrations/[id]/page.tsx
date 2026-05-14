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
} from "@/services/registration.service";
import { RegistrationInfoCards } from "./_components/registration-info-cards";
import { ReviewActionPanel } from "./_components/review-action-panel";
import { RejectDialog } from "./_components/reject-dialog";

export default function RegistrationReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const registrationId = Number(id);

  const [registration, setRegistration] = useState<Registration | null>(null);
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
      const result = await registrationService.approve(registrationId);
      toast.success("Registration approved. Member profile created.");
      router.push(`/borrowers/${result.borrower_id}`);
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
      const result = await registrationService.approve(registrationId);
      toast.success("Registration updated and approved. Member profile created.");
      router.push(`/borrowers/${result.borrower_id}`);
    } catch {
      toast.error("Failed to save and approve. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleReject(reason: string) {
    await registrationService.reject(registrationId, reason);
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

  return (
    <RouteGuard permission="borrowers:create" pageName="Review Registration">
      <>
        <div className="space-y-6 max-w-5xl mx-auto">
          {/* Header */}
          <div>
            <Link
              href="/borrowers"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Members
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">
              Review Registration — {fullName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Submitted {registration.submitted_at ? new Date(registration.submitted_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—"} · Pending verification
            </p>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            <RegistrationInfoCards
              registration={registration}
              editMode={editMode}
              draft={draft}
              onDraftChange={handleDraftChange}
            />
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
