import { cn } from "@/lib/utils";

interface PoweredByLendyProps {
  className?: string;
  /**
   * Set when the mark sits on a colored/dark surface — the wordmark is placed
   * on a white chip so the orange/blue letterforms stay legible.
   */
  onColor?: boolean;
}

/**
 * Small "Powered by Lendy.ph" attribution for page footers. Always renders the
 * bundled Lendy wordmark — unlike <BrandLogo>, it is never replaced by the
 * organization's own logo.
 *
 * Renders a plain <img> rather than next/image for consistency with
 * <BrandLogo> (see the note there).
 */
export function PoweredByLendy({ className, onColor }: PoweredByLendyProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] leading-none",
        onColor ? "text-white/50" : "text-muted-foreground",
        className
      )}
    >
      Powered by
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Logo/Lendy_logo.png"
        alt="Lendy.PH"
        className={cn(
          "h-3 w-auto",
          onColor && "rounded-sm bg-white/95 px-1 py-0.5 box-content"
        )}
      />
    </span>
  );
}
