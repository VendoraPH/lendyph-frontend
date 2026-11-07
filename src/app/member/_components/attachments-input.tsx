"use client";

import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS, MAX_ATTACHMENT_MB } from "@/lib/portal/requests";

/** Optional supporting files for a request or a reply. */
export function AttachmentsInput({
  files,
  onChange,
  id = "request-files",
}: {
  files: File[];
  onChange: (files: File[]) => void;
  id?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Supporting documents (optional)</Label>
      <Input
        id={id}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        disabled={files.length >= MAX_ATTACHMENTS}
        onChange={(e) => {
          onChange([...files, ...Array.from(e.target.files ?? [])].slice(0, MAX_ATTACHMENTS));
          e.target.value = "";
        }}
      />
      <p className="text-xs text-muted-foreground">
        PDF or photo, up to {MAX_ATTACHMENT_MB} MB each, {MAX_ATTACHMENTS} files at most.
      </p>
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm">
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <span className="truncate">{f.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto h-6 w-6"
                aria-label={`Remove ${f.name}`}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
