"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, Upload, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VALID_ID_OPTIONS } from "@/constants";
import { fileUrl } from "@/lib/file-url";
import { ID_MIME_TYPES, validateUploadFile } from "@/lib/file-validation";
import type { RegistrationValidId } from "@/services/registration.service";

export interface ValidIdDraft {
  key: string;
  id: number | null;
  type: string;
  custom_type_name: string;
  id_number: string;
  front_file: File | null;
  front_preview: string | null;
  front_existing_url: string | null;
  back_file: File | null;
  back_preview: string | null;
  back_existing_url: string | null;
}

let draftSeq = 0;
const nextKey = () => `vid-${Date.now()}-${draftSeq++}`;

export function makeEmptyDraft(): ValidIdDraft {
  return {
    key: nextKey(),
    id: null,
    type: "",
    custom_type_name: "",
    id_number: "",
    front_file: null,
    front_preview: null,
    front_existing_url: null,
    back_file: null,
    back_preview: null,
    back_existing_url: null,
  };
}

export function draftFromServer(item: RegistrationValidId): ValidIdDraft {
  return {
    key: nextKey(),
    id: item.id,
    type: item.type,
    custom_type_name: item.custom_type_name ?? "",
    id_number: item.id_number ?? "",
    front_file: null,
    front_preview: null,
    front_existing_url: item.front_url ?? null,
    back_file: null,
    back_preview: null,
    back_existing_url: item.back_url ?? null,
  };
}

type Side = "front" | "back";

interface Props {
  drafts: ValidIdDraft[];
  onChange: (updater: (prev: ValidIdDraft[]) => ValidIdDraft[]) => void;
}

export function RegistrationValidIdsEditor({ drafts, onChange }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function patch(key: string, changes: Partial<ValidIdDraft>) {
    onChange((prev) =>
      prev.map((d) => (d.key === key ? { ...d, ...changes } : d))
    );
  }

  function handlePick(
    key: string,
    side: Side,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const errKey = `${key}-${side}`;
    const result = validateUploadFile(file, ID_MIME_TYPES);
    if (!result.ok) {
      setErrors((prev) => ({ ...prev, [errKey]: result.error ?? "Invalid file." }));
      return;
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next[errKey];
      return next;
    });
    const preview = file.type.startsWith("image/")
      ? URL.createObjectURL(file)
      : null;
    patch(
      key,
      side === "front"
        ? { front_file: file, front_preview: preview }
        : { back_file: file, back_preview: preview }
    );
  }

  function revertSide(key: string, side: Side) {
    patch(
      key,
      side === "front"
        ? { front_file: null, front_preview: null }
        : { back_file: null, back_preview: null }
    );
  }

  function removeDraft(key: string) {
    onChange((prev) => prev.filter((d) => d.key !== key));
  }

  function addDraft() {
    onChange((prev) => [...prev, makeEmptyDraft()]);
  }

  return (
    <div className="space-y-4 pt-1">
      {drafts.length === 0 && (
        <p className="text-sm text-muted-foreground italic py-1">
          No valid IDs on file. Add one below.
        </p>
      )}

      {drafts.map((d) => {
        const isExisting = d.id != null;
        return (
          <div
            key={d.key}
            className="rounded-lg border border-border bg-muted/20 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0 space-y-2">
                {isExisting ? (
                  <div>
                    <p className="text-sm font-semibold capitalize">
                      {d.custom_type_name?.trim() ||
                        VALID_ID_OPTIONS.find((o) => o.value === d.type)?.label ||
                        d.type}
                    </p>
                    {d.id_number && (
                      <p className="text-xs text-muted-foreground font-mono">
                        {d.id_number}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">ID Type</Label>
                      <Select
                        value={d.type || null}
                        onValueChange={(v) => patch(d.key, { type: v ?? "" })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select ID type" />
                        </SelectTrigger>
                        <SelectContent>
                          {VALID_ID_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">ID Number</Label>
                      <Input
                        value={d.id_number}
                        onChange={(e) =>
                          patch(d.key, { id_number: e.target.value })
                        }
                        placeholder="ID number"
                      />
                    </div>
                    {d.type === "others" && (
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">ID Name</Label>
                        <Input
                          value={d.custom_type_name}
                          onChange={(e) =>
                            patch(d.key, { custom_type_name: e.target.value })
                          }
                          placeholder="e.g. Company ID"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive shrink-0"
                onClick={() => removeDraft(d.key)}
                aria-label="Remove valid ID"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(["front", "back"] as Side[]).map((side) => {
                const file = side === "front" ? d.front_file : d.back_file;
                const preview = side === "front" ? d.front_preview : d.back_preview;
                const existing =
                  side === "front" ? d.front_existing_url : d.back_existing_url;
                const shownSrc = preview || (existing ? fileUrl(existing) : "");
                const errKey = `${d.key}-${side}`;
                return (
                  <div key={side} className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                      {side}
                    </Label>
                    <div className="relative aspect-[3/2] overflow-hidden rounded-md border border-border bg-muted/30 flex items-center justify-center">
                      {shownSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={shownSrc}
                          alt={`${side}`}
                          className="h-full w-full object-cover"
                        />
                      ) : file ? (
                        <span className="text-xs text-muted-foreground px-2 text-center truncate">
                          {file.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">
                          No image
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs flex-1"
                        onClick={() => inputRefs.current[errKey]?.click()}
                      >
                        <Upload className="h-3 w-3" />
                        {existing || file ? "Replace" : "Upload"}
                      </Button>
                      {file && existing && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => revertSide(d.key, side)}
                          aria-label="Undo replacement"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                      <input
                        ref={(el) => {
                          inputRefs.current[errKey] = el;
                        }}
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        className="hidden"
                        onChange={(e) => handlePick(d.key, side, e)}
                      />
                    </div>
                    {errors[errKey] && (
                      <p className="text-[11px] text-destructive">
                        {errors[errKey]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={addDraft}
      >
        <Plus className="h-4 w-4" />
        Add Valid ID
      </Button>
    </div>
  );
}
