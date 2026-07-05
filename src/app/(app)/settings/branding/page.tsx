"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PermissionGate, RouteGuard } from "@/components/common";
import { brandingService } from "@/services";
import { compressImage } from "@/lib/image-compress";
import { fileUrl } from "@/lib/file-url";
import { siteConfig } from "@/config/site";

const DEFAULT_LOGO = "/Logo/Lendy_logo.png";
const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5MB — matches the backend cap.

// ── API error helper (matches the settings/profile convention) ──

type ApiError = {
  response?: { data?: { message?: string; errors?: Record<string, string[]> } };
};

function showApiError(err: unknown, fallback: string): void {
  const apiError = err as ApiError;
  const errors = apiError?.response?.data?.errors;
  if (errors) {
    const firstError = Object.values(errors)[0]?.[0];
    toast.error(firstError || fallback);
    return;
  }
  toast.error(apiError?.response?.data?.message || fallback);
}

export default function BrandingSettingsPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

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
        setLogoUrl(res?.logo_url ?? null);
      } catch (err) {
        if (!cancelled) showApiError(err, "Failed to load branding settings.");
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
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
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
      // Downscale/re-encode oversized images client-side, same as the public
      // registration uploads, so the request stays under the server cap.
      const compressed = await compressImage(selectedFile);
      const res = await brandingService.uploadLogo(compressed);
      setLogoUrl(res?.logo_url ?? null);
      resetSelection();
      toast.success(res?.message || "Logo updated.");
    } catch (err) {
      showApiError(err, "Failed to upload logo.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      const res = await brandingService.deleteLogo();
      setLogoUrl(res?.logo_url ?? null);
      resetSelection();
      toast.success(res?.message || "Logo reset to the default.");
    } catch (err) {
      showApiError(err, "Failed to reset logo.");
    } finally {
      setRemoving(false);
    }
  };

  const hasCustomLogo = Boolean(logoUrl);
  const currentSrc = logoUrl ? fileUrl(logoUrl) : DEFAULT_LOGO;
  const displaySrc = previewUrl ?? currentSrc;
  const busy = saving || removing;

  return (
    <RouteGuard permission="settings:view" pageName="Branding Settings">
      <div className="space-y-6 min-w-0">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Branding</h1>
          <p className="text-muted-foreground">
            Set your organization logo. It appears on the sign-in and public
            registration pages and in the app sidebar.
          </p>
        </div>

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
                    accept="image/*"
                    onChange={handleFileSelect}
                    disabled={busy}
                  />
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, WEBP, or SVG up to 5MB. A wide, transparent PNG
                    looks best in the sidebar.
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
