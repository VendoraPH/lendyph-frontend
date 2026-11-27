"use client";

import { useRef } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
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
import { cn } from "@/lib/utils";
import {
  VALID_ID_FILE_ACCEPT,
  VALID_ID_TEXT_MAX_LENGTH,
  validIdTypeLabel,
  type CoMakerIdDraft,
  type CoMakerIdErrors,
  type CoMakerIdField,
} from "@/lib/co-maker-valid-id";

interface CoMakerValidIdFieldsProps {
  draft: CoMakerIdDraft;
  errors: CoMakerIdErrors;
  onChange: (patch: Partial<CoMakerIdDraft>) => void;
  onPickFile: (file: File | null) => boolean;
  disabled?: boolean;
}

/** The ID's type, number and photo — one upload to the co-maker's valid IDs. */
export function CoMakerValidIdFields({
  draft,
  errors,
  onChange,
  onPickFile,
  disabled,
}: CoMakerValidIdFieldsProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const invalid = (field: CoMakerIdField) => (errors[field] ? true : undefined);
  const errorId = (field: CoMakerIdField) => (errors[field] ? `cm_id_${field}_error` : undefined);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cm_id_type">Valid ID Type</Label>
          <Select
            value={draft.type || null}
            onValueChange={(v) => onChange({ type: v ?? "" })}
            disabled={disabled}
          >
            <SelectTrigger
              id="cm_id_type"
              className="w-full"
              aria-invalid={invalid("type")}
              aria-describedby={errorId("type")}
            >
              <SelectValue placeholder="Select ID type">
                {(value: string | null) => (value ? validIdTypeLabel(value) : "Select ID type")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {VALID_ID_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id="cm_id_type_error" className="text-xs">
            {errors.type}
          </FieldError>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cm_id_number">Valid ID Number</Label>
          <Input
            id="cm_id_number"
            placeholder="ID number"
            value={draft.id_number}
            onChange={(e) => onChange({ id_number: e.target.value })}
            maxLength={VALID_ID_TEXT_MAX_LENGTH}
            disabled={disabled}
            aria-invalid={invalid("id_number")}
            aria-describedby={errorId("id_number")}
          />
          <FieldError id="cm_id_id_number_error" className="text-xs">
            {errors.id_number}
          </FieldError>
        </div>
      </div>

      {draft.type === "others" && (
        <div className="space-y-2">
          <Label htmlFor="cm_id_custom_type">What ID is it?</Label>
          <Input
            id="cm_id_custom_type"
            placeholder="e.g. Company ID"
            value={draft.custom_type_name}
            onChange={(e) => onChange({ custom_type_name: e.target.value })}
            maxLength={VALID_ID_TEXT_MAX_LENGTH}
            disabled={disabled}
            aria-invalid={invalid("custom_type_name")}
            aria-describedby={errorId("custom_type_name")}
          />
          <FieldError id="cm_id_custom_type_name_error" className="text-xs">
            {errors.custom_type_name}
          </FieldError>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="cm_id_file">Valid ID Photo</Label>
        {/* A real button, so the picker is reachable by keyboard. Buttons take
            no aria-invalid; the error is announced through aria-describedby. */}
        <button
          type="button"
          id="cm_id_file"
          onClick={() => fileInput.current?.click()}
          disabled={disabled}
          aria-describedby={cn("cm_id_file_hint", errorId("file"))}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors outline-none hover:border-brand-orange/40 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
            errors.file ? "border-destructive/60" : "border-muted-foreground/25"
          )}
        >
          <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <span className="max-w-full truncate text-sm text-muted-foreground">
            {draft.file ? draft.file.name : "Click to upload ID photo"}
          </span>
          <span id="cm_id_file_hint" className="text-xs text-muted-foreground">
            JPG, PNG or PDF, up to 10 MB
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={VALID_ID_FILE_ACCEPT}
          className="hidden"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Cleared so that choosing the same file again still fires.
            e.target.value = "";
            if (file) onPickFile(file);
          }}
        />
        {draft.file && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onPickFile(null)}
            disabled={disabled}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Remove photo
          </Button>
        )}
        <FieldError id="cm_id_file_error" className="text-xs">
          {errors.file}
        </FieldError>
      </div>
    </div>
  );
}
