"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Image as ImageIcon, Loader2, Save, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { PermissionGate, RouteGuard } from "@/components/common";
import { brandingService } from "@/services";
import { toBrandingIdentity, useBrandingStore } from "@/store/branding-store";
import { compressImage } from "@/lib/image-compress";
import { fileUrl, withVersion } from "@/lib/file-url";
import { notifyError } from "@/lib/notify";
import { siteConfig } from "@/config/site";

const DEFAULT_LOGO = "/Logo/Lendy_logo.png";
const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5MB — matches the backend cap.
// Alpha-capable raster + JPEG only. SVG is intentionally excluded (stored SVG is
// an XSS surface, and the backend's `image` rule rejects it anyway); the upload
// step below preserves transparency for PNG/WEBP so logos don't get a black box.
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

// Mirrors the server-side validation so an over-long value is caught before the
// request rather than coming back as a 422.
const MAX_NAME = 255;
const MAX_ADDRESS = 500;
const MAX_CONTACT = 255;

/** Empty input → null: the API stores absence as null, never "". */
const orNull = (value: string): string | null => value.trim() || null;

export default function BrandingSettingsPage() {
  // The logo lives in the shared store so an upload here immediately updates
  // the sidebar logo (and any other mounted <BrandLogo>) without a reload. The
  // organization name is stored alongside it because report and printable
  // letterheads read it from the same place.
  const logoUrl = useBrandingStore((s) => s.logoUrl);
  const version = useBrandingStore((s) => s.version);
  const updateLogo = useBrandingStore((s) => s.updateLogo);
  const updateOrganization = useBrandingStore((s) => s.updateOrganization);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [organizationName, setOrganizationName] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Bumping this remounts the file <input> to clear its displayed filename
  // after an upload, a cancel, or a rejected selection.
  const [inputKey, setInputKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await brandingService.get();
        if (cancelled) return;
        const branding = toBrandingIdentity(res);
        // Read the action off the store instead of subscribing to it: this
        // effect calls it once on mount and never needs to re-run, so the
        // dependency array stays empty.
        useBrandingStore.getState().hydrate(branding);
        // The inputs are uncontrolled by the store on purpose — typing must not
        // repaint every letterhead on screen before the change is saved.
        setOrganizationName(branding.organizationName ?? "");
        setAddress(branding.address ?? "");
        setContact(branding.contact ?? "");
      } catch (err) {
        if (!cancelled) notifyError(err, "We couldn't load your branding settings. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Revoke the object URL when the preview changes or the page unmounts.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const resetSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setInputKey((k) => k + 1);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast.error("Please choose a PNG, JPG, or WEBP image.");
      setInputKey((k) => k + 1);
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Logo must be 5MB or smaller.");
      setInputKey((k) => k + 1);
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile || saving) return;
    setSaving(true);
    try {
      // Downscale/re-encode oversized images client-side so the request stays
      // under the server cap. Preserve transparency for alpha-capable formats —
      // re-encoding a transparent PNG/WEBP to JPEG would fill it with black.
      const preserveAlpha =
        selectedFile.type === "image/png" || selectedFile.type === "image/webp";
      const compressed = await compressImage(
        selectedFile,
        preserveAlpha ? { mimeType: selectedFile.type } : {}
      );
      const res = await brandingService.uploadLogo(compressed);
      updateLogo(res?.logo_url ?? null);
      resetSelection();
      toast.success(res?.message || "Logo updated.");
    } catch (err) {
      notifyError(err, "We couldn't upload your logo. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      const res = await brandingService.deleteLogo();
      updateLogo(res?.logo_url ?? null);
      resetSelection();
      toast.success(res?.message || "Logo reset to the default.");
    } catch (err) {
      notifyError(err, "We couldn't reset your logo. Please try again.");
    } finally {
      setRemoving(false);
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingDetails) return;
    setSavingDetails(true);
    try {
      const res = await brandingService.update({
        organization_name: orNull(organizationName),
        organization_address: orNull(address),
        organization_contact: orNull(contact),
      });
      const branding = toBrandingIdentity(res);
      // The mutation returns the same payload the read does, so the store is
      // updated from the response rather than by refetching it.
      updateOrganization({
        organizationName: branding.organizationName,
        address: branding.address,
        contact: branding.contact,
      });
      setOrganizationName(branding.organizationName ?? "");
      setAddress(branding.address ?? "");
      setContact(branding.contact ?? "");
      toast.success("Organization details saved.");
    } catch (err) {
      notifyError(err, "We couldn't save your organization details. Please try again.");
    } finally {
      setSavingDetails(false);
    }
  };

  const hasCustomLogo = Boolean(logoUrl);
  const currentSrc = logoUrl
    ? withVersion(fileUrl(logoUrl), version)
    : DEFAULT_LOGO;
  const displaySrc = previewUrl ?? currentSrc;
  const busy = saving || removing;

  return (
    <RouteGuard permission="settings:view" pageName="Branding Settings">
      <div className="space-y-6 min-w-0">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Branding</h1>
          <p className="text-muted-foreground">
            Set your organization name and logo. They appear on the sign-in and
            public registration pages, in the app sidebar, and on the letterhead
            of every report and printed document.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Organization Details
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <PermissionGate
              permission="settings:update"
              fallback={
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium">Organization name</dt>
                    <dd className="text-sm text-muted-foreground">
                      {organizationName || `Not set — documents show ${siteConfig.name}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium">Contact</dt>
                    <dd className="text-sm text-muted-foreground">
                      {contact || "Not set"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium">Address</dt>
                    <dd className="text-sm text-muted-foreground whitespace-pre-line">
                      {address || "Not set"}
                    </dd>
                  </div>
                </dl>
              }
            >
              <form onSubmit={handleSaveDetails} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="organization-name">Organization name</Label>
                  <Input
                    id="organization-name"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    maxLength={MAX_NAME}
                    placeholder={siteConfig.name}
                    disabled={loading || savingDetails}
                    autoComplete="organization"
                  />
                  <p className="text-xs text-muted-foreground">
                    Printed at the top of every report, statement, and legal
                    document. Left blank, documents fall back to{" "}
                    {siteConfig.name}.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organization-address">Address</Label>
                  <Textarea
                    id="organization-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    maxLength={MAX_ADDRESS}
                    rows={2}
                    placeholder="123 Rizal St., Brgy. Poblacion, Bacolod City 6100"
                    disabled={loading || savingDetails}
                    autoComplete="street-address"
                  />
                  <p className="text-xs text-muted-foreground">
                    Printed under the organization name on every report and
                    document. This is public — anyone who opens the sign-in page
                    can read it, so use your office address, never someone&apos;s
                    home.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organization-contact">Contact</Label>
                  <Input
                    id="organization-contact"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    maxLength={MAX_CONTACT}
                    placeholder="(034) 123-4567 / info@example.coop"
                    disabled={loading || savingDetails}
                  />
                  <p className="text-xs text-muted-foreground">
                    Phone, email, or both — shown under the organization name on
                    printed documents. This is public too: anyone who opens the
                    sign-in page can read it. Use an office line or a shared
                    inbox, not a staff member&apos;s name and personal mobile.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={loading || savingDetails}
                  className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark w-full sm:w-auto"
                >
                  {savingDetails ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {savingDetails ? "Saving…" : "Save details"}
                </Button>
              </form>
            </PermissionGate>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              Organization Logo
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-6 pt-6">
            {/* Preview */}
            <div className="space-y-2">
              <span className="text-sm font-medium">
                {previewUrl ? "Preview" : "Current logo"}
              </span>
              <div className="flex items-center justify-center rounded-lg border border-dashed bg-muted/30 p-6">
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displaySrc}
                    alt={siteConfig.name}
                    className="h-16 w-auto max-w-full object-contain"
                  />
                )}
              </div>
              {!loading && !hasCustomLogo && !previewUrl && (
                <p className="text-xs text-muted-foreground">
                  No custom logo set — showing the default {siteConfig.name} logo.
                </p>
              )}
            </div>

            <PermissionGate
              permission="settings:update"
              fallback={
                <p className="text-sm text-muted-foreground">
                  You don&apos;t have permission to change the logo.
                </p>
              }
            >
              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="logo-file">Upload a new logo</Label>
                  <Input
                    key={inputKey}
                    id="logo-file"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileSelect}
                    disabled={busy}
                  />
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, or WEBP up to 5MB. A wide, transparent PNG looks
                    best in the sidebar.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    onClick={handleUpload}
                    disabled={!selectedFile || busy}
                    className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark w-full sm:w-auto"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {saving ? "Uploading…" : "Upload Logo"}
                  </Button>

                  {selectedFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={resetSelection}
                      disabled={busy}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRemove}
                    disabled={!hasCustomLogo || busy}
                    title={
                      hasCustomLogo
                        ? "Remove the custom logo and revert to the default"
                        : "No custom logo to remove"
                    }
                    className="w-full sm:ml-auto sm:w-auto"
                  >
                    {removing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    {removing ? "Resetting…" : "Reset to default"}
                  </Button>
                </div>
              </div>
            </PermissionGate>
          </CardContent>
        </Card>
      </div>
    </RouteGuard>
  );
}
