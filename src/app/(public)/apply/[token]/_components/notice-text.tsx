import type { PublicNotice } from "@/types/public-application";

/** A notice's text, folded, marked as a draft until it is the owner's final wording. */
export function NoticeText({ label, notice }: { label: string; notice: PublicNotice }) {
  return (
    <details className="rounded-lg border bg-muted/30 p-3 text-sm">
      <summary className="cursor-pointer font-medium">Read the {label.toLowerCase()}</summary>
      {!notice.final && <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">Draft wording, until the cooperative approves its own.</p>}
      <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-line text-muted-foreground">{notice.text}</p>
    </details>
  );
}
