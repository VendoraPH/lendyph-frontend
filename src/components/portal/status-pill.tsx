import { cn } from "@/lib/utils";
import { TONE_CLASS, labelOf, toneOf, type Tone } from "@/lib/portal/labels";

interface StatusPillProps {
  /** The stored key ("past_due"). */
  value: string | null | undefined;
  /** Its words, from an explicit map; an unknown key reads "Other". */
  labels: Readonly<Record<string, string>>;
  tones?: Readonly<Record<string, Tone>>;
  className?: string;
}

/** A status in words, in a coloured pill. The colour never carries meaning on its own. */
export function StatusPill({ value, labels, tones = {}, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASS[toneOf(tones, value)],
        className,
      )}
    >
      {labelOf(labels, value)}
    </span>
  );
}
