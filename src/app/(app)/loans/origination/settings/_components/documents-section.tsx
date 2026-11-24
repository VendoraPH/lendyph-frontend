"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DocumentRequirement, OriginationSettings } from "@/types/loan-origination";
import { documentTypeKey } from "../../_lib/settings-form";
import { NumberField, SettingsCard } from "./fields";

type Documents = OriginationSettings["documents"];

/**
 * Uploads and document types. The server holds the limits (JPEG, PNG and PDF
 * up to 10 MB) and refuses anything outside them in its own words, as it does
 * a key that reads as "valid ID": the applicant's ID is `government_id`.
 */
export function DocumentsSection({ value, onChange }: { value: Documents; onChange: (next: Documents) => void }) {
  const set = (patch: Partial<Documents>) => onChange({ ...value, ...patch });
  const setType = (i: number, patch: Partial<DocumentRequirement>) =>
    set({ types: value.types.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  return (
    <>
      <SettingsCard
        title="Uploads"
        description="What applicants may upload (JPEG, PNG or PDF, up to 10 MB) and how long files of declined or withdrawn applications are kept."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="file-types">Accepted file types</Label>
            <Input
              id="file-types"
              value={value.accepted_file_types.join(", ")}
              onChange={(e) =>
                set({
                  accepted_file_types: e.target.value
                    .split(",")
                    .map((t) => t.trim().toLowerCase().replace(/^\./, ""))
                    .filter(Boolean),
                })
              }
              placeholder="pdf, jpg, jpeg, png"
            />
            <p className="text-xs text-muted-foreground">Any of jpg, jpeg, jpe, jfif, png and pdf.</p>
          </div>
          <NumberField
            label="Largest file"
            suffix="MB"
            min={1}
            value={value.max_upload_mb}
            onChange={(v) => set({ max_upload_mb: v ?? 1 })}
          />
          <NumberField
            label="Keep files of declined or withdrawn applications for"
            suffix="days"
            min={30}
            hint="From 30 to 3,650 days."
            value={value.retention_days}
            onChange={(v) => set({ retention_days: v ?? 30 })}
          />
        </div>
      </SettingsCard>
      <SettingsCard
        title="Document types"
        description="The documents a loan product can ask for. Choose which each product needs under Products. A saved type keeps its key; a new one is keyed from its name when saved."
      >
        <ul className="space-y-3">
          {value.types.map((t, i) => (
            <li key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_2fr_auto_auto] sm:items-start">
              <div className="space-y-1">
                <Input
                  aria-label="Document name"
                  maxLength={100}
                  value={t.label}
                  onChange={(e) => setType(i, { label: e.target.value })}
                  placeholder="Latest payslip"
                />
                <p className="font-mono text-xs text-muted-foreground">Key: {t.type || documentTypeKey(t.label) || "—"}</p>
              </div>
              <Input
                aria-label="Guidance for applicants"
                maxLength={500}
                value={t.description ?? ""}
                onChange={(e) => setType(i, { description: e.target.value || null })}
                placeholder="Guidance for applicants (optional)"
              />
              <label className="flex h-8 items-center gap-2 text-sm whitespace-nowrap">
                <Checkbox checked={t.required} onCheckedChange={(required) => setType(i, { required })} />
                Always required
              </label>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Remove ${t.label || "document type"}`}
                onClick={() => set({ types: value.types.filter((_, j) => j !== i) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => set({ types: [...value.types, { type: "", label: "", description: null, required: false }] })}
        >
          <Plus className="mr-1 h-4 w-4" /> Add document type
        </Button>
      </SettingsCard>
    </>
  );
}
