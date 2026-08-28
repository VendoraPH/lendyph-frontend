// src/app/(app)/borrowers/registrations/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { notifyError } from "@/lib/notify";
import { AxiosError } from "axios";
import { ArrowLeft, AlertTriangle, Maximize2 } from "lucide-react";
import { RouteGuard, ImagePreviewDialog, type PreviewImage } from "@/components/common";
import { Spinner } from "@/components/ui/spinner";
import {
  registrationService,
  type Registration,
  type RegistrationPayload,
  type RegistrationValidId,
} from "@/services/registration.service";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getInitials } from "@/lib/initials";
import { fileUrl, urlToFile } from "@/lib/file-url";
import { VALID_ID_OPTIONS } from "@/constants";
import { RegistrationInfoCards } from "./_components/registration-info-cards";
import { ReviewActionPanel } from "./_components/review-action-panel";
import { RejectDialog } from "./_components/reject-dialog";
import {
  RegistrationValidIdsEditor,
  draftFromServer,
  type ValidIdDraft,
} from "./_components/registration-valid-ids-editor";
import { compressImage } from "@/lib/image-compress";

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
  const [idDrafts, setIdDrafts] = useState<ValidIdDraft[]>([]);
  const [approving, setApproving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [idPreview, setIdPreview] = useState<{ title: string; images: PreviewImage[] } | null>(null);

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
        setLoadError("We couldn't load this registration. It may have been processed already.");
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
    } catch (err) {
      // Approval is gated server-side (still pending + at least one valid ID on
      // file). Those 422s explain exactly what is missing, so surface the
      // server's wording — a generic "please try again" sends the operator
      // round in circles looking for a fault that isn't there.
      notifyError(err, "We couldn't approve the registration. Please try again.");
    } finally {
      setApproving(false);
    }
  }

  async function deleteValidIdIdempotent(validIdId: number) {
    // A retry after a partial sync failure (delete OK, recreate failed) will
    // hit a 404 here. Treat that as success so the loop can continue and
    // re-upload the replacement.
    try {
      await registrationService.deleteValidId(registrationId, validIdId);
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 404) return;
      throw err;
    }
  }

  async function syncValidIds() {
    // Entries removed from the editor (existing id no longer present) → delete.
    const keptIds = new Set(
      idDrafts.filter((d) => d.id != null).map((d) => d.id as number)
    );
    for (const v of validIds) {
      if (!keptIds.has(v.id)) {
        await deleteValidIdIdempotent(v.id);
      }
    }

    for (const d of idDrafts) {
      const isNew = d.id == null;
      const replaced = !isNew && (d.front_file != null || d.back_file != null);
      if (!isNew && !replaced) continue; // unchanged existing entry

      // Replacing an existing entry: there is no per-side update endpoint, so
      // we have to delete the old grouped entry and re-create it. Resolve ALL
      // files (new uploads + refetches of the untouched side) BEFORE deleting,
      // so a CORS-blocked refetch doesn't silently lose the untouched side.
      const front = d.front_file
        ? await compressImage(d.front_file)
        : replaced
        ? await urlToFile(d.front_existing_url, "front.jpg")
        : null;
      const back = d.back_file
        ? await compressImage(d.back_file)
        : replaced
        ? await urlToFile(d.back_existing_url, "back.jpg")
        : null;

      if (replaced) {
        const lostFront = !d.front_file && d.front_existing_url && !front;
        const lostBack = !d.back_file && d.back_existing_url && !back;
        if (lostFront || lostBack) {
          throw new Error(
            "Couldn't preserve the unchanged side of an ID image (storage blocked the refetch). Please re-upload both sides and try again."
          );
        }
      }

      if (!d.type || (!front && !back)) continue; // skip incomplete entries

      if (replaced) {
        await deleteValidIdIdempotent(d.id as number);
      }

      const fd = new FormData();
      fd.append("type", d.type);
      if (d.type === "others" && d.custom_type_name.trim()) {
        fd.append("custom_type_name", d.custom_type_name.trim());
      }
      if (d.id_number.trim()) fd.append("id_number", d.id_number.trim());
      if (front) fd.append("front_file", front);
      if (back) fd.append("back_file", back);
      await registrationService.uploadValidId(registrationId, fd);
    }
  }

  // Re-read the valid IDs the server actually holds. Run after any failed
  // save: drafts still carry `id: null` for entries syncValidIds has already
  // uploaded, so re-pressing Save & Approve would upload them a second time.
  // Re-seeding from the server clears that.
  async function reloadValidIds() {
    try {
      const ids = await registrationService.listValidIds(registrationId);
      const fresh = Array.isArray(ids) ? ids : [];
      setValidIds(fresh);
      setIdDrafts(fresh.map(draftFromServer));
    } catch {
      // Best-effort — leaving the editor as it stands beats emptying it.
    }
  }

  async function handleSaveEdit() {
    setSavingEdit(true);
    // Which step we're on. Each one commits before the next begins, so a
    // failure has to name the step that actually failed — claiming "nothing
    // was saved" after `update()` has already landed pushes the operator into
    // re-submitting edits that are stored, which is how duplicates get made.
    let phase: "details" | "ids" | "approve" = "details";
    try {
      await registrationService.update(registrationId, draft);
      phase = "ids";
      await syncValidIds();
      phase = "approve";
      await registrationService.approve(registrationId);
      toast.success("Registration updated and approved. Member profile activated.");
      router.push(`/borrowers/${registrationId}`);
    } catch (err) {
      if (phase === "details") {
        notifyError(err, "We couldn't save this registration. Please try again.");
      } else if (phase === "ids") {
        notifyError(
          err,
          "We couldn't finish updating the valid IDs. Please try again.",
          "The rest of your changes were saved."
        );
      } else {
        // Only the approval gate refused — the applicant is no longer pending,
        // or still has no valid ID on file. Stay in edit mode so the operator
        // can fix the cause rather than losing the screen.
        notifyError(
          err,
          "We couldn't approve this registration. Please try again.",
          "Your changes were saved — only the approval didn't go through."
        );
      }
      // Any failure past `update()` can leave the editor out of step with the
      // server: syncValidIds deletes and re-uploads entry by entry, so a
      // half-finished run leaves drafts still marked new that are already
      // stored. Re-seed from the server before any retry — skipping this is
      // what puts two copies of the same ID on an applicant's file.
      await reloadValidIds();
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleReject(reason: string) {
    // RejectDialog only clears its submitting flag; without this catch a failed
    // reject looked to the operator like nothing happened at all.
    try {
      await registrationService.reject(registrationId, { reason });
      toast.success("Registration rejected. The record was kept, not deleted.");
      setRejectOpen(false);
      router.push("/borrowers");
    } catch (err) {
      notifyError(err, "We couldn't reject this registration. Please try again.");
      // Re-throw purely as a signal: the dialog stays open and keeps the typed
      // reason for a retry. The message is already on screen, so RejectDialog
      // swallows this rather than reporting it twice.
      throw err;
    }
  }

  function openValidId(item: RegistrationValidId, label: string) {
    const images: PreviewImage[] = [];
    if (item.front_url) images.push({ url: fileUrl(item.front_url), caption: "Front" });
    if (item.back_url) images.push({ url: fileUrl(item.back_url), caption: "Back" });
    if (images.length === 0) return;
    setIdPreview({ title: label, images });
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
  // Drives the copy and hides the review controls: this page is reachable
  // from the Rejected tab, where the decision has already been made.
  const isRejected = registration.status === "rejected";

  return (
    <RouteGuard permission="borrowers:approve" pageName="Review Registration">
      <>
        <div className="space-y-4 max-w-7xl mx-auto">
          {/* Header */}
          <Link
            href="/borrowers"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Members
          </Link>
          <div className="flex items-center gap-5">
            <button
              type="button"
              aria-label={registration.photo_url ? "View profile photo" : "Profile photo"}
              onClick={() => registration.photo_url && setPhotoViewerOpen(true)}
              disabled={!registration.photo_url}
              className="group relative block shrink-0 rounded-full"
            >
              <Avatar className="size-20 sm:size-24">
                {registration.photo_url ? (
                  <AvatarImage src={fileUrl(registration.photo_url)} alt={fullName} />
                ) : null}
                <AvatarFallback className="bg-brand-orange/10 text-brand-orange text-2xl font-semibold">
                  {getInitials(fullName)}
                </AvatarFallback>
              </Avatar>
              {registration.photo_url ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="h-5 w-5 text-white" />
                </div>
              ) : null}
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight truncate">
                {isRejected ? "Rejected Application" : "Review Registration"} — {fullName}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Submitted {registration.submitted_at ? new Date(registration.submitted_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—"} ·{" "}
                {isRejected ? "Rejected — see the reason on the right" : "Pending verification"}
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

              <Card>
                <CardContent className="pt-5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-3 pb-2 border-b border-brand-orange/20">
                    Valid IDs
                  </h3>
                  {editMode ? (
                    <RegistrationValidIdsEditor
                      drafts={idDrafts}
                      onChange={setIdDrafts}
                    />
                  ) : validIds.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-2">
                      No valid IDs were uploaded with this application.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      {validIds.map((item) => {
                        const label =
                          item.custom_type_name?.trim() ||
                          VALID_ID_OPTIONS.find((o) => o.value === item.type)?.label ||
                          item.type;
                        const sides = [
                          { side: "Front", src: fileUrl(item.front_url) },
                          { side: "Back", src: fileUrl(item.back_url) },
                        ].filter((s) => s.src);
                        return (
                          <div key={item.id} className="space-y-2">
                            <div>
                              <p className="text-sm font-semibold capitalize">
                                {label}
                              </p>
                              {item.id_number && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  {item.id_number}
                                </p>
                              )}
                            </div>
                            {sides.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">
                                No images uploaded
                              </p>
                            ) : (
                              <div className="grid grid-cols-2 gap-2">
                                {sides.map((s) => (
                                  <button
                                    key={s.side}
                                    type="button"
                                    onClick={() => openValidId(item, label)}
                                    className="group relative block aspect-[3/2] overflow-hidden rounded-md border border-border bg-muted/30 hover:border-brand-orange/50 transition-colors"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={s.src}
                                      alt={`${label} ${s.side}`}
                                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Maximize2 className="h-5 w-5 text-white" />
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                              {sides.map((s) => s.side).join(" · ")}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <ReviewActionPanel
              registration={registration}
              editMode={editMode}
              approving={approving}
              savingEdit={savingEdit}
              onApprove={handleApprove}
              onReject={() => setRejectOpen(true)}
              onToggleEdit={() => {
                setEditMode((prev) => {
                  const next = !prev;
                  if (next) setIdDrafts(validIds.map(draftFromServer));
                  else setIdDrafts([]);
                  return next;
                });
                setDraft({});
              }}
              onSaveEdit={handleSaveEdit}
            />
          </div>
        </div>

        <RejectDialog
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          onConfirm={handleReject}
        />

        <ImagePreviewDialog
          open={!!idPreview}
          onOpenChange={(o) => !o && setIdPreview(null)}
          title={idPreview?.title}
          images={idPreview?.images ?? []}
        />

        <Dialog open={photoViewerOpen} onOpenChange={setPhotoViewerOpen}>
          <DialogContent size="lg" className="p-0">
            <DialogHeader className="p-4 pb-2">
              <DialogTitle>{fullName}</DialogTitle>
            </DialogHeader>
            {registration.photo_url ? (
              <div className="flex items-center justify-center p-4 pt-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl(registration.photo_url)}
                  alt={fullName}
                  className="max-h-[70vh] w-auto max-w-full rounded-lg object-contain"
                />
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </>
    </RouteGuard>
  );
}