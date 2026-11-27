import { cn } from "@/lib/utils";
import { TONE_CLASS, type Tone } from "../_lib/labels";

/** A status in words with its tone. */
export function StateBadge({ label, tone, className }: { label: string; tone: Tone; className?: string }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", TONE_CLASS[tone], className)}>
      {label}
    </span>
  );
}
